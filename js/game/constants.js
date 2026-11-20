/**
 * 『Photo バト』ゲームルール定数定義
 * 担当：碓氷（ゲームシステム）
 */

export const GAME_RULES = {
  DECK_SIZE: 30,              // デッキ枚数（30枚固定）
  MAX_SAME_CARD: 3,           // 同名カード上限（3枚まで）
  INITIAL_HAND_SIZE: 3,       // 初期手札枚数
  MAX_HAND_SIZE: 10,          // 手札上限枚数
  INITIAL_ENERGY: 3,          // 初期エネルギー
  MAX_ENERGY_LIMIT: 10,       // エネルギー上限の最大値
  INITIAL_LIFE: 10,           // 初期ライフ
  MAX_STRIKER_ZONE: 5,        // ストライカーゾーン上限（5体）
  MAX_SUPPORT_ZONE: 2,        // サポートゾーン上限（2体）
  FIRST_TURN_ATTACK_LIMIT: 1  // 先攻1ターン目の攻撃回数上限
};

// カードタイプ
export const CARD_TYPE = {
  STRIKER: 'striker',     // ストライカー
  SUPPORTER: 'supporter', // サポーター
  MAGIC: 'magic',         // 魔法
  EQUIP: 'equip'          // 装備
};

// ゲーム進行フェイズ（ステップ）
export const PHASE = {
  START: 'start',     // 1. スタートステップ
  MAIN: 'main',       // 2. メインステップ
  ATTACK: 'attack',   // 3. アタックステップ
  END: 'end'          // 4. エンドステップ
};

// ユニットのタップ状態
export const UNIT_STATE = {
  UNTAPPED: 'untapped', // アンタップ状態（行動可能）
  TAPPED: 'tapped'      // タップ状態（攻撃済み・攻撃対象になり得る）
};