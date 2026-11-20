/**
 * 『Photo バト』ゲームエンジン（ルール・進行管理）
 * 担当：碓氷（ゲームシステム）
 */

import { GAME_RULES, CARD_TYPE, PHASE, UNIT_STATE } from './constants.js';

export class GameEngine {
  constructor() {
    this.players = {
      player: this.createInitialPlayerState('プレイヤー'),
      enemy: this.createInitialPlayerState('AIエネミー')
    };
    this.turnCount = 0;
    this.currentPlayerKey = 'player'; // 'player' または 'enemy'
    this.currentPhase = PHASE.START;
    this.firstPlayerKey = 'player';   // 先攻プレイヤー
    this.attacksThisTurn = 0;         // このターンの攻撃回数（先攻1ターン目制限用）
    this.winner = null;               // 勝者 ('player' | 'enemy' | null)
    this.logs = [];                   // バトルログ
  }

  /**
   * プレイヤーの初期状態を作成する
   */
  createInitialPlayerState(name) {
    return {
      name: name,
      life: GAME_RULES.INITIAL_LIFE,         // 10
      energy: GAME_RULES.INITIAL_ENERGY,     // 3
      maxEnergy: GAME_RULES.INITIAL_ENERGY,  // 3
      deck: [],          // 山札（上限なし・初期30枚）
      hand: [],          // 手札（上限10枚）
      strikerZone: [],   // ストライカーゾーン（上限5体）
      supportZone: [],   // サポートゾーン（上限2体）
      graveyard: []      // 墓地（上限なし）
    };
  }

  /**
   * ログを追加する（UI表示やデバッグ用）
   */
  addLog(message) {
    this.logs.push(message);
    console.log(`[GameLog] ${message}`);
  }

  /**
   * 配列をランダムにシャッフルする（フィッシャー–イェーツ法）
   */
  shuffle(cards) {
    const array = [...cards];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * 山札が0枚になった時、即座に墓地を全てシャッフルして山札に加える
   */
  checkAndRefreshDeck(playerKey) {
    const p = this.players[playerKey];
    if (p.deck.length === 0 && p.graveyard.length > 0) {
      p.deck = this.shuffle(p.graveyard);
      p.graveyard = [];
      this.addLog(`${p.name}の山札が0枚になったため、墓地をシャッフルして山札を再構築しました。`);
    }
  }

  /**
   * 山札の上からカードを1枚引く（手札上限・山札リフレッシュ対応）
   */
  drawCard(playerKey, count = 1) {
    const p = this.players[playerKey];

    for (let i = 0; i < count; i++) {
      // 引く前に山札が0枚ならリフレッシュ確認
      this.checkAndRefreshDeck(playerKey);

      // 山札も墓地も空の場合は引けない
      if (p.deck.length === 0) {
        this.addLog(`${p.name}は山札も墓地もないためカードを引けません。`);
        break;
      }

      const drawnCard = p.deck.shift(); // 山札の一番上から1枚取り出す

      // 所持可能手札上限(10枚)を超える場合は墓地へ置く
      if (p.hand.length >= GAME_RULES.MAX_HAND_SIZE) {
        p.graveyard.push(drawnCard);
        this.addLog(`${p.name}の手札が上限(${GAME_RULES.MAX_HAND_SIZE}枚)のため、「${drawnCard.name}」は墓地へ送られました。`);
      } else {
        p.hand.push(drawnCard);
        this.addLog(`${p.name}がカードを1枚引きました。`);
      }

      // 引いた直後に山札が0枚になった場合も即座にリフレッシュ
      this.checkAndRefreshDeck(playerKey);
    }
  }

  /**
   * ゲームを開始する
   * @param {Array} playerDeck - プレイヤーの30枚デッキ配列
   * @param {Array} enemyDeck - 相手の30枚デッキ配列
   * @param {string} firstPlayer - 'player' または 'enemy'
   */
  startGame(playerDeck, enemyDeck, firstPlayer = 'player') {
    this.players.player = this.createInitialPlayerState('プレイヤー');
    this.players.enemy = this.createInitialPlayerState('AIエネミー');

    // カード1枚ごとに場での識別用ID（instanceId）を付与してシャッフル
    this.players.player.deck = this.shuffle(this.assignInstanceIds(playerDeck, 'p'));
    this.players.enemy.deck = this.shuffle(this.assignInstanceIds(enemyDeck, 'e'));

    this.turnCount = 0;
    this.firstPlayerKey = firstPlayer;
    this.currentPlayerKey = firstPlayer;
    this.winner = null;
    this.logs = [];

    this.addLog('=== ゲーム開始 ===');

    // 両プレイヤーは山札の上から3枚カードを引く
    this.drawCard('player', GAME_RULES.INITIAL_HAND_SIZE);
    this.drawCard('enemy', GAME_RULES.INITIAL_HAND_SIZE);

    // 先攻の1ターン目を開始
    this.startTurn();
  }

  /**
   * 同名カードが複数あっても区別できるよう、個別の instanceId を振る
   */
  assignInstanceIds(deck, prefix) {
    return deck.map((card, index) => ({
      ...card,
      instanceId: `${prefix}_${index}_${card.id}`
    }));
  }

  /**
   * 相手プレイヤーのキーを取得するユーティリティ
   */
  getOpponentKey(playerKey) {
    return playerKey === 'player' ? 'enemy' : 'player';
  }

  /**
   * 1. スタートステップ（ターン開始処理）
   */
  startTurn() {
    if (this.winner) return;

    this.turnCount += 1;
    this.attacksThisTurn = 0;
    this.currentPhase = PHASE.START;

    const p = this.players[this.currentPlayerKey];
    this.addLog(`--- ターン ${this.turnCount}（${p.name}のターン）---`);

    // 自軍ストライカーをすべてアンタップ状態に戻す
    p.strikerZone.forEach(unit => {
      unit.state = UNIT_STATE.UNTAPPED;
    });

    // ① ターン開始時効果誘発（※効果システム実装時にここへフックを接続）
    this.triggerPhaseEffects('on_turn_start', this.currentPlayerKey);

    // ② 山札の上からカードを1枚引く
    this.drawCard(this.currentPlayerKey, 1);

    // ③ エネルギー上限+1（最大10）＆使用済みエネルギー全回復
    if (p.maxEnergy < GAME_RULES.MAX_ENERGY_LIMIT) {
      p.maxEnergy += 1;
    }
    p.energy = p.maxEnergy;
    this.addLog(`${p.name}のエネルギーが回復しました（${p.energy}/${p.maxEnergy}）。`);

    // 自動的に2. メインステップへ移行
    this.currentPhase = PHASE.MAIN;
    this.addLog(`【メインステップ】カードの使用やサポート効果の発動が可能です。`);
  }

  /**
   * フェイズを次へ進める（メイン -> アタック -> エンド -> 相手ターン）
   */
  nextPhase() {
    if (this.winner) return;

    if (this.currentPhase === PHASE.MAIN) {
      this.currentPhase = PHASE.ATTACK;
      this.addLog(`【アタックステップ】ストライカーで攻撃が可能です。`);
    } else if (this.currentPhase === PHASE.ATTACK) {
      this.endTurn();
    }
  }

  /**
   * 4. エンドステップ（ターン終了処理）
   */
  endTurn() {
    if (this.winner) return;

    this.currentPhase = PHASE.END;
    const p = this.players[this.currentPlayerKey];
    this.addLog(`【エンドステップ】${p.name}のターン終了処理を行います。`);

    // ターン終了時効果誘発
    this.triggerPhaseEffects('on_turn_end', this.currentPlayerKey);

    // ターン移行
    this.currentPlayerKey = this.getOpponentKey(this.currentPlayerKey);
    this.startTurn();
  }

  /**
   * タイミング誘発効果のプレースホルダー（ステップ7以降で詳細実装）
   */
  triggerPhaseEffects(timing, playerKey) {
    const p = this.players[playerKey];

    // ストライカーゾーンとサポートゾーンのカードを確認
    const allFieldUnits = [...p.strikerZone, ...p.supportZone];
    allFieldUnits.forEach(unit => {
      if (unit.effect && unit.effect.trigger === timing) {
        this.addLog(`「${unit.name}」の誘発効果が発動！`);
        this.resolveEffect(playerKey, unit.effect, unit);
      }
    });
  }

  /**
   * 2. メインステップ：手札のカードを使用する
   * @param {string} playerKey - 'player' または 'enemy'
   * @param {number} handIndex - 手札配列内のインデックス
   * @param {object} targetInfo - 対象指定が必要な場合の情報（例: { targetInstanceId: '...' }）
   * @returns {boolean} 使用に成功したかどうか
   */
resolveEffect(playerKey, effect, sourceCard, targetInfo = {}) {
    if (!effect || !effect.action) return;

    const p = this.players[playerKey];
    const opponentKey = this.getOpponentKey(playerKey);
    const opponent = this.players[opponentKey];

    switch (effect.action) {
      case 'draw': {
        // 山札からカードをvalue枚引く
        this.drawCard(playerKey, effect.value || 1);
        break;
      }

      case 'gain_energy': {
        // エネルギーをvalue回復（現在の上限まで）
        const before = p.energy;
        p.energy = Math.min(p.maxEnergy, p.energy + (effect.value || 1));
        this.addLog(`${p.name}のエネルギーが ${p.energy - before} 回復しました（${p.energy}/${p.maxEnergy}）。`);
        break;
      }

      case 'damage_striker': {
        // 相手ストライカー1体にvalueダメージ（パワー減少・0以下で破壊）
        const target = opponent.strikerZone.find(u => u.instanceId === targetInfo.targetInstanceId);
        if (!target) {
          this.addLog('ダメージ対象のストライカーが指定されていないため不発となりました。');
          return;
        }
        const dmg = effect.value || 0;
        target.currentPower -= dmg;
        this.addLog(`「${target.name}」に ${dmg} ダメージ！（残りパワー: ${Math.max(0, target.currentPower)}）`);

        if (target.currentPower <= 0) {
          this.addLog(`パワーが0以下になったため、「${target.name}」は破壊されました！`);
          this.destroyUnit(opponentKey, target.instanceId);
        }
        break;
      }

      case 'damage_player': {
        // 相手プレイヤーにvalueダメージ
        const dmg = effect.value || 0;
        opponent.life = Math.max(0, opponent.life - dmg);
        this.addLog(`${opponent.name}に効果で ${dmg} ダメージ！（残りライフ: ${opponent.life}）`);
        this.checkWinner();
        break;
      }

      case 'heal_life': {
        // 自分のライフをvalue回復
        const heal = effect.value || 0;
        p.life += heal;
        this.addLog(`${p.name}のライフが ${heal} 回復しました！（現在ライフ: ${p.life}）`);
        break;
      }

      case 'buff_power': {
        // 自分のストライカー1体のパワーを+value
        const target = p.strikerZone.find(u => u.instanceId === targetInfo.targetInstanceId);
        if (!target) {
          this.addLog('強化対象のストライカーが指定されていないため不発となりました。');
          return;
        }
        const buff = effect.value || 0;
        target.currentPower += buff;
        this.addLog(`「${target.name}」のパワーが +${buff} されました！（現在パワー: ${target.currentPower}）`);
        break;
      }

      default:
        this.addLog(`未定義の効果アクションです: ${effect.action}`);
        break;
    }
  }

  playCard(playerKey, handIndex, targetInfo = {}) {
    if (this.winner) return false;
    if (this.currentPlayerKey !== playerKey || this.currentPhase !== PHASE.MAIN) {
      this.addLog('現在はカードを使用できません。');
      return false;
    }

    const p = this.players[playerKey];
    const card = p.hand[handIndex];
    if (!card) return false;

    // コスト確認
    if (p.energy < card.cost) {
      this.addLog(`エネルギーが足りません（必要: ${card.cost} / 現在: ${p.energy}）。`);
      return false;
    }

    // カードタイプ別の事前条件チェック
    if (card.type === CARD_TYPE.STRIKER && p.strikerZone.length >= GAME_RULES.MAX_STRIKER_ZONE) {
      this.addLog(`ストライカーゾーンが上限(${GAME_RULES.MAX_STRIKER_ZONE}体)のため出撃できません。`);
      return false;
    }
    if (card.type === CARD_TYPE.SUPPORTER && p.supportZone.length >= GAME_RULES.MAX_SUPPORT_ZONE) {
      this.addLog(`サポートゾーンが上限(${GAME_RULES.MAX_SUPPORT_ZONE}体)のため設置できません。`);
      return false;
    }
    if (card.type === CARD_TYPE.EQUIP) {
      const targetUnit = p.strikerZone.find(u => u.instanceId === targetInfo.targetInstanceId);
      if (!targetUnit) {
        this.addLog('装備対象のストライカーが指定されていません。');
        return false;
      }
    }

    // コスト支払い＆手札から取り除く
    p.energy -= card.cost;
    p.hand.splice(handIndex, 1);

    // タイプごとの配置・発動処理
    switch (card.type) {
      case CARD_TYPE.STRIKER: {
        const unit = {
          ...card,
          currentPower: card.power,
          currentStrike: card.strike,
          state: UNIT_STATE.UNTAPPED,
          equips: [] // 装備カードを格納する配列
        };
        p.strikerZone.push(unit);
        this.addLog(`${p.name}が「${card.name}」を出撃させました！（残りエネルギー: ${p.energy}）`);
        
        // 出撃時効果の誘発
        if (card.effect && card.effect.trigger === 'on_summon') {
          this.resolveEffect(playerKey, card.effect, unit, targetInfo);
        }
        break;
      }

      case CARD_TYPE.SUPPORTER: {
        const unit = { ...card };
        p.supportZone.push(unit);
        this.addLog(`${p.name}が「${card.name}」を設置しました！（残りエネルギー: ${p.energy}）`);
        break;
      }

      case CARD_TYPE.MAGIC: {
        this.addLog(`${p.name}が魔法「${card.name}」を唱えました！（残りエネルギー: ${p.energy}）`);
        if (card.effect) {
          this.resolveEffect(playerKey, card.effect, card, targetInfo);
        }
        // 使用後墓地へ置く
        p.graveyard.push(card);
        break;
      }

      case CARD_TYPE.EQUIP: {
        const targetUnit = p.strikerZone.find(u => u.instanceId === targetInfo.targetInstanceId);
        targetUnit.equips.push(card);
        this.addLog(`${p.name}が「${targetUnit.name}」に「${card.name}」を装備しました！（残りエネルギー: ${p.energy}）`);
        
        // 装備効果の適用（例：パワー上昇など）
        if (card.effect) {
          this.applyEquipEffect(targetUnit, card.effect);
        }
        break;
      }
    }

    return true;
  }

  /**
   * 2. メインステップ：サポートゾーンのサポーター効果を発動する
   */
  activateSupport(playerKey, supportInstanceId, targetInfo = {}) {
    if (this.winner) return false;
    if (this.currentPlayerKey !== playerKey || this.currentPhase !== PHASE.MAIN) {
      this.addLog('現在はサポート効果を発動できません。');
      return false;
    }

    const p = this.players[playerKey];
    const supporter = p.supportZone.find(u => u.instanceId === supportInstanceId);
    if (!supporter || !supporter.supportEffect) return false;

    const cost = supporter.supportCost || 0;
    if (p.energy < cost) {
      this.addLog(`サポート効果のエネルギーが足りません（必要: ${cost} / 現在: ${p.energy}）。`);
      return false;
    }

    p.energy -= cost;
    this.addLog(`${p.name}が「${supporter.name}」のサポート効果を発動！（残りエネルギー: ${p.energy}）`);
    this.resolveEffect(playerKey, supporter.supportEffect, supporter, targetInfo);
    return true;
  }

  /**
   * 装備カードの効果をストライカーへ反映する
   */
  applyEquipEffect(targetUnit, effect) {
    if (effect.action === 'buff_power') {
      targetUnit.currentPower += effect.value;
    } else if (effect.action === 'buff_strike') {
      targetUnit.currentStrike += effect.value;
    }
  }

  /**
   * カード効果の実行処理（ステップ8で各種効果を拡充）
   */
  resolveEffect(playerKey, effect, sourceCard, targetInfo = {}) {
    // ステップ8で具体的な効果（ドロー、エネルギー回復、ダメージ等）を実装します
  }

  /**
   * 攻撃実行前の共通バリデーション（フェイズ、状態、先攻1ターン目制限）
   */
  canAttack(playerKey, attackerInstanceId) {
    if (this.winner) return { ok: false };
    if (this.currentPlayerKey !== playerKey || this.currentPhase !== PHASE.ATTACK) {
      this.addLog('現在はアタックステップではありません。');
      return { ok: false };
    }

    // 先攻1ターン目は1回のみ攻撃可能
    if (this.turnCount === 1 && playerKey === this.firstPlayerKey && this.attacksThisTurn >= GAME_RULES.FIRST_TURN_ATTACK_LIMIT) {
      this.addLog('先攻1ターン目は1回しか攻撃できません。');
      return { ok: false };
    }

    const p = this.players[playerKey];
    const attacker = p.strikerZone.find(u => u.instanceId === attackerInstanceId);
    if (!attacker) {
      this.addLog('指定されたストライカーが見つかりません。');
      return { ok: false };
    }
    if (attacker.state !== UNIT_STATE.UNTAPPED) {
      this.addLog(`「${attacker.name}」はすでにタップ状態のため攻撃できません。`);
      return { ok: false };
    }

    return { ok: true, attacker };
  }

  /**
   * 3-A. アタックステップ：相手プレイヤーへ直接攻撃する
   */
  attackPlayer(playerKey, attackerInstanceId) {
    const check = this.canAttack(playerKey, attackerInstanceId);
    if (!check.ok) return false;

    const { attacker } = check;
    const opponentKey = this.getOpponentKey(playerKey);
    const opponent = this.players[opponentKey];

    // 攻撃ユニットをタップ状態にし、攻撃回数をカウント
    attacker.state = UNIT_STATE.TAPPED;
    this.attacksThisTurn += 1;

    // 打撃力分相手ライフを減少
    const damage = Math.max(0, attacker.currentStrike);
    opponent.life = Math.max(0, opponent.life - damage);
    this.addLog(`「${attacker.name}」が${opponent.name}へダイレクトアタック！ ${damage}ダメージ！（残りライフ: ${opponent.life}）`);

    // 勝敗判定
    this.checkWinner();
    return true;
  }

  /**
   * 3-B. アタックステップ：相手のタップ状態ストライカーへ攻撃（バトル）する
   */
  attackStriker(playerKey, attackerInstanceId, targetInstanceId) {
    const check = this.canAttack(playerKey, attackerInstanceId);
    if (!check.ok) return false;

    const { attacker } = check;
    const opponentKey = this.getOpponentKey(playerKey);
    const opponent = this.players[opponentKey];
    const defender = opponent.strikerZone.find(u => u.instanceId === targetInstanceId);

    if (!defender) {
      this.addLog('攻撃対象のストライカーが見つかりません。');
      return false;
    }

    // ルール：相手の「タップ状態」ストライカーへ攻撃可能
    if (defender.state !== UNIT_STATE.TAPPED) {
      this.addLog(`「${defender.name}」はアンタップ状態のため攻撃対象にできません。`);
      return false;
    }

    // 攻撃ユニットをタップ状態にし、攻撃回数をカウント
    attacker.state = UNIT_STATE.TAPPED;
    this.attacksThisTurn += 1;

    this.addLog(`【バトル開始】「${attacker.name}」(パワー:${attacker.currentPower}) VS 「${defender.name}」(パワー:${defender.currentPower})`);

    // パワー比較による勝敗判定
    if (attacker.currentPower > defender.currentPower) {
      this.addLog(`「${attacker.name}」がバトルに勝利！「${defender.name}」を破壊しました。`);
      this.destroyUnit(opponentKey, defender.instanceId);
    } else if (attacker.currentPower < defender.currentPower) {
      this.addLog(`「${defender.name}」が迎撃に成功！「${attacker.name}」は破壊されました。`);
      this.destroyUnit(playerKey, attacker.instanceId);
    } else {
      this.addLog(`パワーが同値のため相打ち！両方のストライカーが破壊されました。`);
      this.destroyUnit(playerKey, attacker.instanceId);
      this.destroyUnit(opponentKey, defender.instanceId);
    }

    return true;
  }

  /**
   * ユニット破壊処理（ストライカーゾーンから墓地へ送る＋装備品も全て墓地へ）
   */
  destroyUnit(ownerKey, instanceId) {
    const owner = this.players[ownerKey];
    const index = owner.strikerZone.findIndex(u => u.instanceId === instanceId);
    if (index === -1) return;

    const [destroyedUnit] = owner.strikerZone.splice(index, 1);

    // 装備していた装備ユニットは全て墓地へ置かれる
    if (destroyedUnit.equips && destroyedUnit.equips.length > 0) {
      destroyedUnit.equips.forEach(equipCard => {
        owner.graveyard.push(equipCard);
        this.addLog(`装備されていた「${equipCard.name}」も墓地へ送られました。`);
      });
      destroyedUnit.equips = [];
    }

    // 元のステータスにリセットして墓地へ送る
    owner.graveyard.push(destroyedUnit);
  }

  /**
   * 勝敗判定（相手ライフが0以下で勝利）
   */
  checkWinner() {
    if (this.players.player.life <= 0) {
      this.winner = 'enemy';
      this.addLog(`=== 決着！ ${this.players.enemy.name} の勝利！ ===`);
    } else if (this.players.enemy.life <= 0) {
      this.winner = 'player';
      this.addLog(`=== 決着！ ${this.players.player.name} の勝利！ ===`);
    }
  }
}