# 『Photo バト』開発リポジトリ

スマホやPCの写真からオリジナルカードを生成して戦う対戦カードゲーム。

## ディレクトリ構成
- `index.html` / `css/style.css` : 画面レイアウト・UIデザイン（担当：湯淺）
- `js/ui.js` : 画面描画・クリックイベント処理（担当：湯淺）
- `js/storage.js` : デッキ構築・カード保存（LocalStorage）（担当：関口）
- `js/main.js` : 全体統括（UI・データ・ゲームエンジンの接続）（担当：全員）
- `js/game/constants.js` : ゲームルール定数定義（担当：碓氷）
- `js/game/gameEngine.js` : バトル進行・ルール判定エンジン（担当：碓氷）
- `js/game/enemyAi.js` : 1人プレイ用AIエネミー思考ロジック（担当：碓氷・関口）
- `data/sample_cards.json` : カードデータの共通JSON規格・サンプル
- `backend/` : Pythonサーバー・画像解析＆カード生成AI（担当：北澤）

---

## 共通カードデータ（JSON）規格（北澤さん・関口さん向け）
生成したカードおよび保存するカードは、以下のJSON形式に統一します（詳細は `data/sample_cards.json` を参照）。

- `id` (string): カード固有ID（例: `"card_001"`）
- `name` (string): カード名
- `type` (string): `"striker"` | `"supporter"` | `"magic"` | `"equip"`
- `cost` (number): 使用コスト
- `strike` (number): 打撃力（※`striker`のみ必須）
- `power` (number): パワー（※`striker`のみ必須）
- `traits` (string[]): 特徴配列（例: `["動物", "闇"]`）
- `imageUrl` (string): 画像パスまたはDataURL
- `flavorText` (string): フレーバーテキスト
- `effect` (object | null): 効果データ（`{ trigger, action, target, value, description }`）
- `supportCost` (number): サポート起動コスト（※`supporter`のみ）
- `supportEffect` (object): サポート起動効果（※`supporter`のみ）

---

## ゲームエンジンの使い方（湯淺さん・UI連携向け）

```javascript
import { GameEngine } from './js/game/gameEngine.js';
import { EnemyAI } from './js/game/enemyAi.js';

const engine = new GameEngine();
const enemyAi = new EnemyAI(engine);

// 1. ゲーム開始（30枚デッキを2つ渡す）
engine.startGame(playerDeck, enemyDeck, 'player');

// 2. 現在の盤面状態を取得して画面に描画する
// engine.players.player  -> { life, energy, maxEnergy, hand, strikerZone, supportZone, deck, graveyard }
// engine.players.enemy   -> 相手の状態
// engine.currentPhase    -> 'start' | 'main' | 'attack' | 'end'
// engine.winner          -> null | 'player' | 'enemy'
// engine.logs            -> バトルログ配列

// 3. プレイヤーの操作メソッド
engine.playCard('player', handIndex, { targetInstanceId }); // 手札からカード使用
engine.activateSupport('player', supportInstanceId);         // サポート効果起動
engine.nextPhase();                                          // フェイズ進行（メイン→アタック→エンド）
engine.attackPlayer('player', attackerInstanceId);           // 相手プレイヤーへ直接攻撃
engine.attackStriker('player', attackerInstanceId, targetInstanceId); // 相手のタップ状態ストライカーへ攻撃

// 4. AIエネミーのターン実行（engine.currentPlayerKey === 'enemy' になったら呼ぶ）
enemyAi.executeTurn();