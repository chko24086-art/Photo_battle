/**
 * 『Photo バト』AIエネミー思考ロジック
 * 担当：碓氷・関口
 * ひとまず仮で作ったけどコード丸々AIに投げて改善できるところがあればどんどん改善しちゃって
 */

import { CARD_TYPE, PHASE, UNIT_STATE, GAME_RULES } from './constants.js';

export class EnemyAI {
  constructor(gameEngine) {
    this.engine = gameEngine;
    this.aiKey = 'enemy';
  }

  /**
   * AIの1ターン分の行動を実行する
   */
  executeTurn() {
    if (this.engine.winner || this.engine.currentPlayerKey !== this.aiKey) {
      return;
    }

    // 1. メインステップの思考・行動
    if (this.engine.currentPhase === PHASE.MAIN) {
      this.playMainPhase();
      this.engine.nextPhase(); // アタックステップへ移行
    }

    // 2. アタックステップの思考・行動
    if (this.engine.currentPhase === PHASE.ATTACK && !this.engine.winner) {
      this.playAttackPhase();
      if (!this.engine.winner) {
        this.engine.nextPhase(); // エンドステップへ移行（プレイヤーのターンへ）
      }
    }
  }

  /**
   * メインステップ：カード使用・サポート起動の優先順位処理
   */
  playMainPhase() {
    const ai = this.engine.players[this.aiKey];
    const player = this.engine.players.player;

    // 1) 設置済みサポーターの起動効果があれば使う
    ai.supportZone.forEach(supporter => {
      if (supporter.supportEffect && ai.energy >= (supporter.supportCost || 0)) {
        this.engine.activateSupport(this.aiKey, supporter.instanceId);
      }
    });

    // 行動できなくなるまで手札のカード使用を試みる（無限ループ防止のため最大10回）
    for (let loop = 0; loop < 10; loop++) {
      let acted = false;

      // 2) サポーター設置（ゾーンに空きがあり、コストが足りる場合）
      if (ai.supportZone.length < GAME_RULES.MAX_SUPPORT_ZONE) {
        const supIdx = ai.hand.findIndex(c => c.type === CARD_TYPE.SUPPORTER && c.cost <= ai.energy);
        if (supIdx !== -1) {
          acted = this.engine.playCard(this.aiKey, supIdx);
          if (acted) continue;
        }
      }

      // 3) ストライカー出撃（コストが高い順に優先して出す）
      if (ai.strikerZone.length < GAME_RULES.MAX_STRIKER_ZONE) {
        const playableStrikers = ai.hand
          .map((card, index) => ({ card, index }))
          .filter(item => item.card.type === CARD_TYPE.STRIKER && item.card.cost <= ai.energy)
          .sort((a, b) => b.card.cost - a.card.cost);

        if (playableStrikers.length > 0) {
          acted = this.engine.playCard(this.aiKey, playableStrikers[0].index);
          if (acted) continue;
        }
      }

      // 4) 装備カード（場にストライカーがいる場合、最もパワーが高い味方に装備）
      if (ai.strikerZone.length > 0) {
        const equipIdx = ai.hand.findIndex(c => c.type === CARD_TYPE.EQUIP && c.cost <= ai.energy);
        if (equipIdx !== -1) {
          const strongestAlly = [...ai.strikerZone].sort((a, b) => b.currentPower - a.currentPower)[0];
          acted = this.engine.playCard(this.aiKey, equipIdx, { targetInstanceId: strongestAlly.instanceId });
          if (acted) continue;
        }
      }

      // 5) 魔法カード（使用可能なものがあれば対象を選んで発動）
      const magicIdx = ai.hand.findIndex(c => c.type === CARD_TYPE.MAGIC && c.cost <= ai.energy);
      if (magicIdx !== -1) {
        const magicCard = ai.hand[magicIdx];
        const action = magicCard.effect?.action;

        if (action === 'damage_striker' && player.strikerZone.length > 0) {
          // 相手の最もパワーが高いストライカーを狙う
          const targetEnemy = [...player.strikerZone].sort((a, b) => b.currentPower - a.currentPower)[0];
          acted = this.engine.playCard(this.aiKey, magicIdx, { targetInstanceId: targetEnemy.instanceId });
          if (acted) continue;
        } else if (action === 'buff_power' && ai.strikerZone.length > 0) {
          const targetAlly = [...ai.strikerZone].sort((a, b) => b.currentPower - a.currentPower)[0];
          acted = this.engine.playCard(this.aiKey, magicIdx, { targetInstanceId: targetAlly.instanceId });
          if (acted) continue;
        } else if (action === 'draw' || action === 'gain_energy' || action === 'damage_player' || action === 'heal_life') {
          acted = this.engine.playCard(this.aiKey, magicIdx);
          if (acted) continue;
        }
      }

      // 何もできる行動がなければループ終了
      if (!acted) break;
    }
  }

  /**
   * アタックステップ：バトルまたはダイレクトアタックの判断
   */
  playAttackPhase() {
    const ai = this.engine.players[this.aiKey];
    const player = this.engine.players.player;

    // 攻撃可能なアンタップ状態のストライカー一覧を取得（配列のコピーを作成して回す）
    const attackers = ai.strikerZone.filter(u => u.state === UNIT_STATE.UNTAPPED);

    for (const attacker of attackers) {
      if (this.engine.winner) break;

      // 先攻1ターン目の攻撃制限チェック
      if (
        this.engine.turnCount === 1 &&
        this.engine.firstPlayerKey === this.aiKey &&
        this.engine.attacksThisTurn >= GAME_RULES.FIRST_TURN_ATTACK_LIMIT
      ) {
        break;
      }

      // 相手のタップ状態のストライカーで、自分が勝てる（パワー以上）対象を探す
      const tappableTargets = player.strikerZone
        .filter(u => u.state === UNIT_STATE.TAPPED && attacker.currentPower >= u.currentPower)
        .sort((a, b) => b.currentPower - a.currentPower); // 倒せる中で一番強い敵を優先

      if (tappableTargets.length > 0) {
        this.engine.attackStriker(this.aiKey, attacker.instanceId, tappableTargets[0].instanceId);
      } else {
        // 攻撃できる敵ユニットがいなければプレイヤーへダイレクトアタック
        this.engine.attackPlayer(this.aiKey, attacker.instanceId);
      }
    }
  }
}