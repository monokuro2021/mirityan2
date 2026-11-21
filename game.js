// ゲーム変数
let lastDrawnNumber = null; // 最後に引いた数字
let lock = false; // カード操作をロックするフラグ
let selectedLevel = 10; // デフォルトレベル
let drawnCards = []; // 引いたカードを記録
let xCardCounts = {}; // 各×カードの引いた回数を記録
let timerInterval = null; // タイマーインターバル
let timeRemaining = 60; // 残り時間（秒）
let bgmAudio = null; // BGMオーディオオブジェクト
let isGameOverSoundPlaying = false; // ゲームオーバー効果音の重複再生を防止するフラグ

// チャレンジモード変数
let challengeMode = false; // チャレンジモードかどうか
let challengeCurrentLevel = 4; // チャレンジモードの現在のレベル（レベル4から開始）
let challengeMaxLevel = 12; // チャレンジモードの最終レベル

// 音量設定
let bgmVolume = 0.5; // BGM音量 (50%)
let sfxVolume = 0.5; // 効果音音量 (50%)
const BGM_CHARE_FACTOR = 0.06; // メインBGM(chare)の音量係数（スライダー値に掛ける）
const BGM_CLEAR_FACTOR = 0.15; // クリアBGMの音量係数
let bgmAudioFactor = BGM_CHARE_FACTOR; // 再生中BGMの音量係数

// オンライン対戦変数
const ONLINE_PEER_PREFIX = 'mirisiren-apd-'; // ルームコード→PeerIDの接頭辞
const ONLINE_LOBBY_PREFIX = 'mirisiren-apd-lobby-'; // 自動マッチングの待機スロットID接頭辞
const ONLINE_LOBBY_SLOTS = 20; // 自動マッチング用の待機スロット数
const ONLINE_PROBE_TIMEOUT = 10000; // スロット応答の待ち時間（海外との接続確立を考慮して長め）
const ONLINE_LOBBY_RESCAN_MIN = 8000; // 待機中の再探索間隔（最小ミリ秒）
const ONLINE_LOBBY_RESCAN_JITTER = 4000; // 再探索間隔に加えるランダム揺らぎ
const ONLINE_START_LEVEL = 4; // 対戦の開始レベル
const ONLINE_MAX_LEVEL = 12; // 両者クリアで引き分けになる上限レベル
let onlineMode = false; // オンライン対戦中かどうか
let isOnlineHost = false; // ホスト（先攻・前半）かどうか
let onlinePeer = null; // PeerJSのPeerオブジェクト
let onlineConn = null; // PeerJSのDataConnection
let onlineLevel = ONLINE_START_LEVEL; // 現在の対戦ステージ
let onlinePhase = 'idle'; // idle | lobby | my-turn | opponent-turn | waiting-result | ended
let myOnlineResult = null; // 自分の今ステージの結果 (clear | fail)
let spectatorLayout = null; // 観戦中に表示している盤面レイアウト（JSON文字列）
let bestStreak = 0; // 現在の挑戦での最長連続めくり数
let bestStreakTime = 0; // 最長連続を達成した時点の残り時間（秒）
let myOnlineStreak = 0; // 自分の今ステージの最長連続めくり数（対戦判定用）
let myOnlineStreakTime = 0; // 同上・達成時の残り時間
let autoMatchProbe = null; // 自動マッチングのスロット探索用の一時Peer
let autoMatchAttempts = 0; // 自動マッチングのリトライ回数
let lobbyRescanTimer = null; // 待機ホストが他スロットを再探索するタイマー
let lobbySlotId = null; // 待機ホストとして取得中のスロットID
let lobbyProbing = false; // 再探索中か（この間は他者からのmatchRequestを拒否）
let peerNickname = ''; // 相手のニックネーム（未受信なら空）
let nameSent = false; // 自分のニックネーム送信済みか
let onlineStatusPhase = ''; // ステータスバーに最後に表示したフェーズ文字
let onlineOverlayMode = null; // 表示中のオンラインオーバーレイの種類（名前反映用）
let pendingMatchStart = false; // 相手のニックネーム受信待ちで対戦開始を保留中
let vsScreenActive = false; // VS表示中かどうか
let vsScreenTimeout = null; // VS表示の自動終了タイマー

// ページ読み込み時に背景画像をランダムに選択
window.onload = function() {
  const backgroundImages = [
    'images/ミリちゃん_N.png',
    'images/ミリちゃん笑.png',
    'images/ミリちゃん_CLOSE.png'
  ];
  const randomIndex = Math.floor(Math.random() * backgroundImages.length);
  const backgroundImage = document.getElementById('background-image');
  if (backgroundImage) {
    backgroundImage.src = backgroundImages[randomIndex];
    
    // ミリちゃん_Nとミリちゃん笑は小さくする
    if (backgroundImages[randomIndex] === 'images/ミリちゃん_N.png' || 
        backgroundImages[randomIndex] === 'images/ミリちゃん笑.png') {
      backgroundImage.style.width = '25vw';
    } else {
      backgroundImage.style.width = '32vw';
    }
  }
};

// チュートリアル画面を表示する関数
function showTutorial() {
  // 直接チュートリアルゲームを開始
  onlineMode = false;
  challengeMode = false;
  document.getElementById('level-selection-screen').style.display = 'none';
  selectedLevel = 'tutorial';
  document.getElementById('game-container').style.display = 'flex';
  
  // ゲームを初期化
  initializeGame();
}

// チュートリアル画面を非表示にする関数
function hideTutorial() {
  document.getElementById('tutorial-screen').style.display = 'none';
  document.getElementById('level-selection-screen').style.display = 'flex';
}

// チャレンジ画面を表示する関数
function showChallenge() {
  // チャレンジモードを有効化
  challengeMode = true;
  onlineMode = false;
  
  document.getElementById('level-selection-screen').style.display = 'none';
  selectedLevel = challengeCurrentLevel;
  document.getElementById('game-container').style.display = 'flex';
  
  // ゲームを初期化
  initializeGame();
}

// チュートリアルゲームを開始する関数
function startTutorial() {
  document.getElementById('tutorial-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'flex';
  
  // チュートリアル用のレベルを設定
  selectedLevel = 'tutorial';
  
  // ゲームを初期化
  initializeGame();
}

// レベル選択関数
function selectLevel(level) {
  selectedLevel = level;
  
  // 全てのレベルボタンからselectedクラスを削除
  const allButtons = document.querySelectorAll('.level-btn');
  allButtons.forEach(btn => btn.classList.remove('selected'));
  
  // 選択されたボタンにselectedクラスを追加（安全な方法）
  const clickedButton = Array.from(allButtons).find(btn => btn.textContent.includes(level));
  if (clickedButton) {
    clickedButton.classList.add('selected');
  }
}

// レベル選択関数（クリックイベント対応版）
function selectLevelWithEvent(level, element) {
  selectedLevel = level;
  challengeMode = false;
  onlineMode = false;
  
  // 全てのレベルボタンからselectedクラスを削除
  const allButtons = document.querySelectorAll('.level-btn');
  allButtons.forEach(btn => btn.classList.remove('selected'));
  
  // 選択されたボタンにselectedクラスを追加
  element.classList.add('selected');
  
  // レベル選択画面を非表示にしてゲーム画面を表示
  document.getElementById('level-selection-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'flex';
  
  // ゲームを初期化
  initializeGame();
}

// カード配置：選択されたレベルに応じて数字カード＋赤×＋青×
function getCardsForLevel(level) {
  const cards = [];
  
  // チュートリアル用：1〜4の数字カードと2枚の×カード
  if (level === 'tutorial' || level === 4) {
    for (let i = 1; i <= 4; i++) {
      cards.push(i); // 1〜4の数字カードを1枚ずつ
    }
    cards.push('red-x', 'blue-x'); // 2枚の×カード
  } else {
    // 通常のレベル設定
    for (let i = 1; i <= level; i++) {
      cards.push(i);
    }
    cards.push('red-x', 'blue-x');
  }
  
  cards.sort(() => Math.random() - 0.5);
  return cards;
}

// スタートゲーム関数
function startGame(event) {
  if (event) event.stopPropagation();
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'flex';
  initializeGame();
}

// タイマー開始関数
function startTimer() {
  // スタートボタンを非表示
  const startContainer = document.getElementById("game-start-container");
  if (startContainer) {
    startContainer.style.display = "none";
  }
  
  // オンライン対戦中は自分の盤面レイアウトを観戦側に送信
  if (onlineMode && onlinePhase === 'my-turn') {
    const layout = Array.from(document.querySelectorAll('#board .card')).map(c => c.dataset.value);
    sendOnline({ type: 'turnLayout', level: onlineLevel, layout: layout });
    updateOnlineStatus('プレイ中');
  }
  
  // タイマーをリセット
  timeRemaining = getTimeLimit();
  updateTimerDisplay();
  
  // カード操作を有効化
  lock = false;
  
  // 巻き戻しボタンを表示（チャレンジモード・オンライン対戦以外）
  const rewindBtn = document.getElementById("rewind-btn");
  if (rewindBtn && !challengeMode && !onlineMode) {
    rewindBtn.style.display = "flex";
  }
  
  // BGMを再生
  playBGM();
  
  // タイマーを開始
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    
    // オンライン対戦中は観戦側に同期スナップショットを送信
    if (onlineMode && onlinePhase === 'my-turn') {
      sendOnlineSnapshot();
    }
    
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      gameOver();
    }
  }, 1000);
}

// BGM再生関数
function playBGM() {
  try {
    bgmAudio = new Audio('bgm/chare.mp3');
    bgmAudio.loop = true; // ループ再生
    bgmAudioFactor = BGM_CHARE_FACTOR;
    bgmAudio.volume = bgmVolume * BGM_CHARE_FACTOR; // 設定された音量の6%を使用（50%設定で3%になる）
    
    // ユーザーインタラクションで再生を試みる
    const playPromise = bgmAudio.play();
    
    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log('BGM再生開始');
      }).catch(error => {
        console.log('BGMの再生に失敗しました:', error);
      });
    } else {
      // 古いブラウザ対応
      bgmAudio.play();
      console.log('BGM再生開始（古いブラウザ）');
    }
  } catch (error) {
    console.log('BGMの作成に失敗しました:', error);
  }
}

// BGM停止関数
function stopBGM() {
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio.currentTime = 0;
    console.log('BGM停止');
  }
}

// タイマー表示更新関数
function updateTimerDisplay() {
  const timerText = document.getElementById("timer-text");
  if (timerText) {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    // 残り10秒になったら背景を黒く変化させる（チュートリアル以外）
    if (timeRemaining === 10 && selectedLevel !== 'tutorial') {
      // 背景色を10秒かけて黒に変化させる（CSSトランジションで滑らかに）
      document.body.style.backgroundColor = 'black';
      console.log('背景色の10秒間の黒への変化を開始');
    }
    
    // 残り13秒になったらBGMの音量を徐々に下げる（チュートリアル以外）
    if (timeRemaining === 13 && selectedLevel !== 'tutorial') {
      // BGM音量調整開始
      if (bgmAudio) {
        console.log('BGM音量調整を開始します（13秒から）');
      }
    }
    
    // 残り13秒〜1秒の間、BGM音量を毎秒調整（チュートリアル以外）
    if (timeRemaining <= 13 && timeRemaining > 0 && bgmAudio && selectedLevel !== 'tutorial') {
      const targetVolume = 0; // 0%
      const initialVolume = bgmVolume * BGM_CHARE_FACTOR; // 設定された音量の6%
      const volumeRange = initialVolume - targetVolume;
      const fadeProgress = (13 - timeRemaining) / 13; // 13秒間で0から1へ
      bgmAudio.volume = initialVolume - (volumeRange * fadeProgress);
      console.log('BGM音量を調整:', bgmAudio.volume);
    }
    
    // 0:00になったら止めて時間切れとして認識
    if (timeRemaining === 0 && minutes === 0 && seconds === 0) {
      timerText.textContent = "0:00";
      console.log('時間切れ：0:00 - 止めて時間切れ');
      
      // 背景は既に黒色になっているはず（チュートリアル以外）
      if (selectedLevel !== 'tutorial') {
        console.log('背景は完全に黒色です');
        
        // BGMを停止（チュートリアル以外）
        stopBGM();
        console.log('0:00 - chareを停止しました');
      }
      
      // ゲームオーバー処理
      setTimeout(() => {
        gameOver();
      }, 100); // 100ms後にゲームオーバー
    } else {
      timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      // タイマーが10秒以下になったらBGMを停止
      if (timeRemaining === 0) {
        setTimeout(() => {
          stopBGM();
          console.log('時間切れ：0:00 - BGM停止');
        }, 0); // 即時実行
      }
    }
  }
}

// ゲームオーバー関数
function gameOver() {
  // チュートリアルの場合はゲームオーバー処理をしない
  if (selectedLevel === 'tutorial') {
    return;
  }
  
  // タイマーを停止
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // カード操作をロック
  lock = true;
  
  // 全てのカードのクリックイベントを無効化
  const allCards = document.querySelectorAll('.card');
  allCards.forEach(card => {
    card.style.pointerEvents = 'none';
    card.style.cursor = 'default';
  });
  
  // 効果音を再生
  playGameOverSound();
  
  // ゲームオーバーメッセージを表示
  const messageDiv = document.createElement("div");
  messageDiv.className = "game-over-message";
  messageDiv.textContent = "ゲームオーバー";
  if (selectedLevel >= 11) messageDiv.style.bottom = '2%';
  document.body.appendChild(messageDiv);
  
  // 「out」画像を永続表示
  showGameOverImage();
  
  // オンライン対戦の場合は観戦側にゲームオーバー演出を通知し、結果を送信して相手の番／集計へ
  if (onlineMode) {
    if (onlinePhase === 'my-turn') {
      sendOnline({ type: 'gameover' });
    }
    setTimeout(() => {
      onMyStageFinished('fail');
    }, 1500);
  }
  
  // 自動で戻らない（コメントアウト）
  // setTimeout(() => {
  //   if (messageDiv.parentNode) {
  //     messageDiv.remove();
  //   }
  //   backToStart();
  // }, 3000);
}

// クリア効果音再生関数
function playClearSound() {
  try {
    console.log('クリア効果音の再生を試みます...');
    
    // 絶対パスで直接MP3ファイルを指定
    const audio = new Audio();
    
    // デスクトップの絶対パスを直接設定
    const desktopPath = 'file:///C:/Users/伊藤　楓/OneDrive/ドキュメント/デスクトップ/coingame.mp3';
    
    console.log('デスクトップの絶対パスを設定:', desktopPath);
    
    audio.src = desktopPath;
    audio.type = 'audio/mpeg';
    audio.volume = 0.8;
    
    // 音声ファイルの読み込みを待機
    audio.addEventListener('canplaythrough', function() {
      console.log('クリア効果音の読み込み完了、再生を開始します');
      console.log('音声タイプ:', audio.type);
      console.log('音声ソース:', audio.src);
      console.log('音声の現在時刻:', audio.currentTime);
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('クリア効果音再生成功');
        }).catch(error => {
          console.log('クリア効果音の再生に失敗しました:', error);
          console.log('失敗時の音声ソース:', audio.src);
          
          // 少し遅延して再試みる
          setTimeout(() => {
            audio.play();
          }, 200);
        });
      } else {
        // 古いブラウザ対応
        audio.play();
        console.log('クリア効果音再生成功（古いブラウザ）');
      }
    });
    
    // 読み込みエラーの場合
    audio.addEventListener('error', function(error) {
      console.log('クリア効果音の読み込みエラー:', error);
      console.log('エラーオブジェクト:', error.target.error);
      console.log('失敗時の音声ソース:', audio.src);
      
      // 少し遅延して再試みる
      setTimeout(() => {
        audio.play();
      }, 300);
    });
    
  } catch (error) {
    console.log('クリア効果音の作成に失敗しました:', error);
  }
}

// 代替再生方法
function tryAlternativePlay() {
  try {
    console.log('代替方法でクリア効果音を再生します...');
    const altAudio = new Audio('coingame.mp3');
    altAudio.volume = 0.8;
    altAudio.play().then(() => {
      console.log('代替方法でのクリア効果音再生成功');
    }).catch(error => {
      console.log('代替方法でも再生に失敗しました:', error);
    });
  } catch (error) {
    console.log('代替方法の作成に失敗しました:', error);
  }
}

// ゲームオーバー効果音再生関数
function playGameOverSound() {
  // 重複再生を防止
  if (isGameOverSoundPlaying) {
    console.log('ゲームオーバー効果音は既に再生中です');
    return;
  }
  
  isGameOverSoundPlaying = true;
  
  try {
    const audio = new Audio('sounds/batu.mp3');
    audio.volume = sfxVolume; // 設定された効果音音量を使用
    
    // 再生完了時にフラグをリセット
    audio.onended = () => {
      isGameOverSoundPlaying = false;
      console.log('ゲームオーバー効果音の再生完了');
    };
    
    audio.play().then(() => {
      console.log('ゲームオーバー効果音再生成功');
    }).catch(error => {
      console.log('ゲームオーバー効果音の再生に失敗しました:', error);
      // エラー時もフラグをリセット
      isGameOverSoundPlaying = false;
      
      // 少し遅延して再試みる
      setTimeout(() => {
        if (!isGameOverSoundPlaying) { // 再度チェック
          audio.play();
        }
      }, 200);
    });
  } catch (error) {
    console.log('ゲームオーバー効果音の作成に失敗しました:', error);
    isGameOverSoundPlaying = false;
  }
}

// レベル選択画面を表示
function showLevelSelection() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('level-selection-screen').style.display = 'flex';
}

// スタート画面に戻る
function backToStartScreen() {
  document.getElementById('level-selection-screen').style.display = 'none';
  document.getElementById('start-screen').style.display = 'flex';
}

// スタート画面に戻る関数
function backToStart() {
  // 全ての画面要素を非表示にする
  document.getElementById('level-selection-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'none';
  document.getElementById('start-screen').style.display = 'flex';
  
  // 全ての動的要素を一度に削除（効率化）
  const dynamicElements = document.querySelectorAll('div[style*="game-over-message"], div[style*="bottom: 5%"], #game-over-image, #x-message, #shuffle-image, .game-over-message, .stage5-image, .stage6-image, .stage7-image, .stage8-image, .stage9-image, .stage10-image, .stage11-image, .stage12-image');
  dynamicElements.forEach(elem => elem.remove());
  
  // 背景を白に戻す
  document.body.style.backgroundColor = 'white';
  
  // BGMを停止
  stopBGM();
  
  // ゲーム状態をリセット
  resetGame();
  
  // タイマーが残っていれば停止
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // ロック状態を解除
  lock = false;
  
  // オンライン対戦の接続と表示をクリーンアップ
  cleanupOnline();
}

// レベルに応じた盤面スロット数を返す
function getTotalSlots(level) {
  if (level === 'tutorial' || level === 4) return 6; // 2×3
  if (level >= 5 && level <= 6) return 8; // 2×4
  if (level === 7) return 9; // 3×3
  if (level >= 8 && level <= 10) return 12; // 3×4
  if (level >= 11 && level <= 12) return 16; // 4×4（オンライン対戦の高レベル用）
  return 12;
}

// カード要素を生成（ゲーム本体・観戦表示で共用）
function createCardElement(cardValue, index) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.value = cardValue;
  card.dataset.position = index + 1;
  
  const cardFront = document.createElement("div");
  cardFront.className = "card-face card-front position-number";
  cardFront.textContent = String.fromCharCode(65 + index);
  
  const cardBack = document.createElement("div");
  cardBack.className = "card-face card-back";
  
  if (cardValue === 'red-x') {
    cardBack.style.backgroundColor = "pink";
    const redImg = document.createElement("img");
    redImg.src = "images/ミリちゃん_N.png";
    redImg.style.cssText = "width: 85%; height: 85%; object-fit: contain;";
    cardBack.appendChild(redImg);
  } else if (cardValue === 'blue-x') {
    cardBack.style.backgroundColor = "lightblue";
    const blueImg = document.createElement("img");
    blueImg.src = "images/ミリちゃん_N.png";
    blueImg.style.cssText = "width: 85%; height: 85%; object-fit: contain;";
    cardBack.appendChild(blueImg);
  } else {
    cardBack.setAttribute('data-number', cardValue);
    cardBack.textContent = cardValue;
  }
  
  card.appendChild(cardFront);
  card.appendChild(cardBack);
  return card;
}

// レベルに応じた制限時間（秒）を返す
function getTimeLimit() {
  if (selectedLevel >= 11 && selectedLevel <= 12) return 70; // レベル11・12は1分10秒
  return 60;
}

// 連続めくり記録の更新（オンライン対戦の両者ゲームオーバー時の判定用）
function recordStreak() {
  if (drawnCards.length > bestStreak) {
    bestStreak = drawnCards.length;
    bestStreakTime = timeRemaining;
  }
}

// ゲーム初期化関数
function initializeGame() {
  const board = document.getElementById("board");
  board.innerHTML = "";
  
  // グローバル変数をリセット
  lastDrawnNumber = null;
  drawnCards = [];
  xCardCounts = {};
  bestStreak = 0;
  bestStreakTime = 0;
  lock = true; // タイマー開始までカード操作をロック
  
  // タイマーをリセット
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  timeRemaining = getTimeLimit();
  updateTimerDisplay();
  
  // チュートリアルの場合はタイマーを非表示
  if (selectedLevel === 'tutorial') {
    document.getElementById('timer-display').style.display = 'none';
    document.getElementById('game-header-image').style.display = 'block';
  } else {
    document.getElementById('timer-display').style.display = 'block';
    document.getElementById('game-header-image').style.display = 'none';
  }
  
  // レベルに応じてクラスを設定
  board.className = "";
  if (selectedLevel === 'tutorial') {
    board.classList.add("tutorial");
  } else {
    // 通常レベル時は画像を非表示
    document.querySelector('.game-side-images').classList.remove('show');
  }
  
  if (selectedLevel >= 4 && selectedLevel <= 12) {
    board.classList.add("level-" + selectedLevel);
  }
  
  const cards = getCardsForLevel(selectedLevel);
  const totalSlots = getTotalSlots(selectedLevel);
  
  cards.forEach((cardValue, index) => {
    const card = createCardElement(cardValue, index);

    // イベントリスナーを一度だけ登録
    card.addEventListener('click', function handleClick(e) {
      console.log('カードクリック:', cardValue, 'lock:', lock, 'open:', card.classList.contains("open"));
      if (lock || card.classList.contains("open")) {
        console.log('クリック無効: lock=' + lock + ', open=' + card.classList.contains("open"));
        return;
      }
      lock = true;
      card.classList.add("open");
      console.log('カードめくり実行:', cardValue);
      
      // オンライン対戦中は観戦側にめくりを通知
      if (onlineMode && onlinePhase === 'my-turn') {
        sendOnline({ type: 'flip', position: card.dataset.position });
      }

      if (cardValue === 'red-x' || cardValue === 'blue-x') {
        // ×カードの引いた回数を記録
        xCardCounts[cardValue] = (xCardCounts[cardValue] || 0) + 1;
        
        // 数字の昇順をリセット
        lastDrawnNumber = null;
        drawnCards = [];
        
        if (selectedLevel === 'tutorial') {
          // チュートリアルの場合：常に「アクマにご注意！」のみ表示
          showXCardMessage("ミリちゃんに注意！");
          setTimeout(() => {
            flipAllCardsBack(); // 全てのカードを裏に戻す
            lock = false;
          }, 1000);
        } else {
          // 通常のレベル設定
          if (xCardCounts[cardValue] === 1) {
            // 1回目：警告メッセージ
            showXCardMessage("ミリちゃんに注意！");
            setTimeout(() => {
              flipAllCardsBack(); // 全てのカードを裏に戻す
              lock = false;
            }, 1000);
          } else if (xCardCounts[cardValue] === 2) {
            // 2回目：シャッフルメッセージと画像
            showXCardMessage(getShuffleMessage());
            showShuffleImage();
            setTimeout(() => {
              flipAllCardsBack(); // 全てのカードを裏に戻す
              shuffleCards();
              // 全ての×カードのカウントをリセット
              xCardCounts = {};
              lock = false;
            }, 1000);
          } else {
            // 3回目以降：通常のリセット
            setTimeout(() => {
              flipAllCardsBack(); // 全てのカードを裏に戻す
              resetGame();
              lock = false;
            }, 1000);
          }
        }
        return;
      }

      if (lastDrawnNumber === null) {
        // 最初のカード
        lastDrawnNumber = cardValue;
        drawnCards.push(cardValue); recordStreak(); // 引いたカードを記録
        lock = false;
      } else {
        if (cardValue === lastDrawnNumber + 1) {
          // 昇順が続いている場合
          lastDrawnNumber = cardValue;
          drawnCards.push(cardValue); recordStreak(); // 引いたカードを記録
          lock = false;
          
          // クリア条件のチェック：1から始まって全ての数字カードが表になっているか
          const allNumbersDrawn = drawnCards.filter(card => typeof card === 'number');
          
          let requiredNumbers;
          let isCompleteClear;
          
          if (selectedLevel === 'tutorial') {
            // チュートリアルの場合：1〜4の数字カードがすべて引かれたらクリア
            requiredNumbers = [1, 2, 3, 4];
            isCompleteClear = allNumbersDrawn.length === requiredNumbers.length &&
                            requiredNumbers.every(num => allNumbersDrawn.includes(num));
          } else {
            // 通常のレベル設定
            requiredNumbers = Array.from({length: selectedLevel}, (_, i) => i + 1);
            isCompleteClear = allNumbersDrawn.length === requiredNumbers.length &&
                            requiredNumbers.every(num => allNumbersDrawn.includes(num)) &&
                            allNumbersDrawn[0] === 1;
          }
          
          if (isCompleteClear) {
            showClearMessage();
            lock = false;
          } else {
            lock = false;
          }
        } else {
          // 昇順が途切れた場合
          setTimeout(() => {
            flipAllCardsBack(); // 全てのカードを裏に戻す
            lastDrawnNumber = null;
            drawnCards = [];
            // xCardCountsはリセットしない（×カードの進行状況を維持）
            lock = false;
          }, 1000);
        }
      }
    });

    board.appendChild(card);
  });
  
  // 空きスロットを追加
  for (let i = cards.length; i < totalSlots; i++) {
    const emptySlot = document.createElement("div");
    emptySlot.className = "empty-slot";
    board.appendChild(emptySlot);
  }
  
  // 巻き戻しボタンを非表示にする
  const rewindBtn = document.getElementById("rewind-btn");
  if (rewindBtn) {
    rewindBtn.style.display = "none";
  }
}

// ゲームをリセット
function resetGame() {
  lastDrawnNumber = null;
  drawnCards = []; // 引いたカード記録もリセット
  xCardCounts = {}; // ×カードの引いた回数もリセット
  const allCards = document.querySelectorAll(".card");
  allCards.forEach(card => {
    card.classList.remove("open");
  });
  // メッセージをクリア
  const messageDiv = document.getElementById("message");
  if (messageDiv) {
    messageDiv.textContent = "";
  }
}

// ×カードのメッセージ表示
function showXCardMessage(message) {
  // 既存のメッセージを削除
  const existingMessage = document.getElementById("x-message");
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // 新しいメッセージを作成
  const messageDiv = document.createElement("div");
  messageDiv.id = "x-message";
  const xBottom = selectedLevel >= 11 ? '2%' : '5%';
  messageDiv.style.cssText = `
    position: fixed;
    bottom: ${xBottom};
    left: 50%;
    transform: translateX(-50%);
    background: rgba(138, 43, 226, 0.8);
    color: white;
    padding: 1.5vw 3vw;
    border-radius: 1vw;
    font-size: 2.5vw;
    z-index: 1000;
    font-family: 'JF-Dot-Kaname12', monospace;
  `;
  messageDiv.textContent = message;
  document.body.appendChild(messageDiv);
  
  // オンライン対戦中は観戦側にメッセージを通知（観戦側からの適用時は再送しない）
  if (onlineMode && onlinePhase === 'my-turn') {
    sendOnline({ type: 'xmsg', text: message });
  }
  
  // 「シャッフルします♪」の場合は画像も表示
  if (message.includes("シャッフル")) {
    showShuffleImage();
  }
  
  // 1.0秒後にメッセージを削除
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 1000);
}

// ステージ9専用画像を表示
function showStage9Images() {
  // ステージ9画像設定
  const stage9Config = {
    leftImage: {
      src: "images/ゆらぎ_N.png",
      top: "48.5%",
      left: "16%",
      maxWidth: "29vw",
      maxHeight: "39vw"
    },
    rightImage: {
      src: "images/ミリちゃん_N.png",
      top: "53%",
      right: "18%",
      maxWidth: "18vw",
      maxHeight: "27vw"
    }
  };
  
  // 既存の画像を削除
  const existingImages = document.querySelectorAll('.stage9-image');
  existingImages.forEach(img => img.remove());
  
  // 左側の画像
  const leftImage = document.createElement("div");
  leftImage.className = "stage9-image";
  leftImage.style.cssText = `
    position: fixed;
    top: ${stage9Config.leftImage.top};
    left: ${stage9Config.leftImage.left};
    transform: translate(-50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const leftImg = document.createElement("img");
  leftImg.src = stage9Config.leftImage.src;
  leftImg.style.cssText = `
    max-width: ${stage9Config.leftImage.maxWidth};
    max-height: ${stage9Config.leftImage.maxHeight};
    object-fit: contain;
  `;
  
  leftImage.appendChild(leftImg);
  document.body.appendChild(leftImage);
  
  // 右側の画像
  const rightImage = document.createElement("div");
  rightImage.className = "stage9-image";
  rightImage.style.cssText = `
    position: fixed;
    top: ${stage9Config.rightImage.top};
    right: ${stage9Config.rightImage.right};
    transform: translate(50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const rightImg = document.createElement("img");
  rightImg.src = stage9Config.rightImage.src;
  rightImg.style.cssText = `
    max-width: ${stage9Config.rightImage.maxWidth};
    max-height: ${stage9Config.rightImage.maxHeight};
    object-fit: contain;
  `;
  
  rightImage.appendChild(rightImg);
  document.body.appendChild(rightImage);
}

// ステージ10専用画像を表示
function showStage10Images() {
  // ステージ10画像設定
  const stage10Config = {
    leftImage: {
      src: "images/こま_N.png",
      top: "47.5%",
      left: "17%",
      maxWidth: "29vw",
      maxHeight: "39vw"
    },
    rightImage: {
      src: "images/ミリちゃん_N.png",
      top: "52%",
      right: "18%",
      maxWidth: "18vw",
      maxHeight: "27vw"
    }
  };
  
  // 既存の画像を削除
  const existingImages = document.querySelectorAll('.stage10-image');
  existingImages.forEach(img => img.remove());
  
  // 左側の画像
  const leftImage = document.createElement("div");
  leftImage.className = "stage10-image";
  leftImage.style.cssText = `
    position: fixed;
    top: ${stage10Config.leftImage.top};
    left: ${stage10Config.leftImage.left};
    transform: translate(-50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const leftImg = document.createElement("img");
  leftImg.src = stage10Config.leftImage.src;
  leftImg.style.cssText = `
    max-width: ${stage10Config.leftImage.maxWidth};
    max-height: ${stage10Config.leftImage.maxHeight};
    object-fit: contain;
  `;
  
  leftImage.appendChild(leftImg);
  document.body.appendChild(leftImage);
  
  // 右側の画像
  const rightImage = document.createElement("div");
  rightImage.className = "stage10-image";
  rightImage.style.cssText = `
    position: fixed;
    top: ${stage10Config.rightImage.top};
    right: ${stage10Config.rightImage.right};
    transform: translate(50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const rightImg = document.createElement("img");
  rightImg.src = stage10Config.rightImage.src;
  rightImg.style.cssText = `
    max-width: ${stage10Config.rightImage.maxWidth};
    max-height: ${stage10Config.rightImage.maxHeight};
    object-fit: contain;
  `;
  
  rightImage.appendChild(rightImg);
  document.body.appendChild(rightImage);
}

// ステージ11専用画像を表示
function showStage11Images() {
  // ステージ11画像設定
  const stage11Config = {
    leftImage: {
      src: "images/雨夜リズ_N.png",
      top: "46%",
      left: "15.5%",
      maxWidth: "29vw",
      maxHeight: "39vw"
    },
    rightImage: {
      src: "images/ミリちゃん_N.png",
      top: "52%",
      right: "18%",
      maxWidth: "18vw",
      maxHeight: "27vw"
    }
  };
  
  // 既存の画像を削除
  const existingImages = document.querySelectorAll('.stage11-image');
  existingImages.forEach(img => img.remove());
  
  // 左側の画像
  const leftImage = document.createElement("div");
  leftImage.className = "stage11-image";
  leftImage.style.cssText = `
    position: fixed;
    top: ${stage11Config.leftImage.top};
    left: ${stage11Config.leftImage.left};
    transform: translate(-50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const leftImg = document.createElement("img");
  leftImg.src = stage11Config.leftImage.src;
  leftImg.style.cssText = `
    max-width: ${stage11Config.leftImage.maxWidth};
    max-height: ${stage11Config.leftImage.maxHeight};
    object-fit: contain;
  `;
  
  leftImage.appendChild(leftImg);
  document.body.appendChild(leftImage);
  
  // 右側の画像
  const rightImage = document.createElement("div");
  rightImage.className = "stage11-image";
  rightImage.style.cssText = `
    position: fixed;
    top: ${stage11Config.rightImage.top};
    right: ${stage11Config.rightImage.right};
    transform: translate(50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const rightImg = document.createElement("img");
  rightImg.src = stage11Config.rightImage.src;
  rightImg.style.cssText = `
    max-width: ${stage11Config.rightImage.maxWidth};
    max-height: ${stage11Config.rightImage.maxHeight};
    object-fit: contain;
  `;
  
  rightImage.appendChild(rightImg);
  document.body.appendChild(rightImage);
}

// ステージ12専用画像を表示
function showStage12Images() {
  // ステージ12画像設定
  const stage12Config = {
    leftImage: {
      src: "images/眠雲ツクリ_N.png",
      top: "46%",
      left: "17%",
      maxWidth: "29vw",
      maxHeight: "39vw"
    },
    rightImage: {
      src: "images/ミリちゃん_N.png",
      top: "52%",
      right: "18%",
      maxWidth: "18vw",
      maxHeight: "27vw"
    }
  };
  
  // 既存の画像を削除
  const existingImages = document.querySelectorAll('.stage12-image');
  existingImages.forEach(img => img.remove());
  
  // 左側の画像
  const leftImage = document.createElement("div");
  leftImage.className = "stage12-image";
  leftImage.style.cssText = `
    position: fixed;
    top: ${stage12Config.leftImage.top};
    left: ${stage12Config.leftImage.left};
    transform: translate(-50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const leftImg = document.createElement("img");
  leftImg.src = stage12Config.leftImage.src;
  leftImg.style.cssText = `
    max-width: ${stage12Config.leftImage.maxWidth};
    max-height: ${stage12Config.leftImage.maxHeight};
    object-fit: contain;
  `;
  
  leftImage.appendChild(leftImg);
  document.body.appendChild(leftImage);
  
  // 右側の画像
  const rightImage = document.createElement("div");
  rightImage.className = "stage12-image";
  rightImage.style.cssText = `
    position: fixed;
    top: ${stage12Config.rightImage.top};
    right: ${stage12Config.rightImage.right};
    transform: translate(50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const rightImg = document.createElement("img");
  rightImg.src = stage12Config.rightImage.src;
  rightImg.style.cssText = `
    max-width: ${stage12Config.rightImage.maxWidth};
    max-height: ${stage12Config.rightImage.maxHeight};
    object-fit: contain;
  `;
  
  rightImage.appendChild(rightImg);
  document.body.appendChild(rightImage);
}

// ステージ8専用画像を表示
function showStage8Images() {
  // ステージ8画像設定
  const stage8Config = {
    leftImage: {
      src: "images/らこ_N.png",
      top: "46.5%",
      left: "18%",
      maxWidth: "29vw",
      maxHeight: "39vw"
    },
    rightImage: {
      src: "images/ミリちゃん_N.png",
      top: "52%",
      right: "18%",
      maxWidth: "18vw",
      maxHeight: "27vw"
    }
  };
  
  // 既存の画像を削除
  const existingImages = document.querySelectorAll('.stage8-image');
  existingImages.forEach(img => img.remove());
  
  // 左側の画像
  const leftImage = document.createElement("div");
  leftImage.className = "stage8-image";
  leftImage.style.cssText = `
    position: fixed;
    top: ${stage8Config.leftImage.top};
    left: ${stage8Config.leftImage.left};
    transform: translate(-50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const leftImg = document.createElement("img");
  leftImg.src = stage8Config.leftImage.src;
  leftImg.style.cssText = `
    max-width: ${stage8Config.leftImage.maxWidth};
    max-height: ${stage8Config.leftImage.maxHeight};
    object-fit: contain;
  `;
  
  leftImage.appendChild(leftImg);
  document.body.appendChild(leftImage);
  
  // 右側の画像
  const rightImage = document.createElement("div");
  rightImage.className = "stage8-image";
  rightImage.style.cssText = `
    position: fixed;
    top: ${stage8Config.rightImage.top};
    right: ${stage8Config.rightImage.right};
    transform: translate(50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const rightImg = document.createElement("img");
  rightImg.src = stage8Config.rightImage.src;
  rightImg.style.cssText = `
    max-width: ${stage8Config.rightImage.maxWidth};
    max-height: ${stage8Config.rightImage.maxHeight};
    object-fit: contain;
  `;
  
  rightImage.appendChild(rightImg);
  document.body.appendChild(rightImage);
}

// ステージ7専用画像を表示
function showStage7Images() {
  // ステージ7画像設定
  const stage7Config = {
    leftImage: {
      src: "images/あくび_N.png",
      top: "47.5%",
      left: "18.4%",
      maxWidth: "29vw",
      maxHeight: "39vw"
    },
    rightImage: {
      src: "images/ミリちゃん_N.png",
      top: "52%",
      right: "20.5%",
      maxWidth: "18vw",
      maxHeight: "27vw"
    }
  };
  
  // 既存の画像を削除
  const existingImages = document.querySelectorAll('.stage7-image');
  existingImages.forEach(img => img.remove());
  
  // 左側の画像
  const leftImage = document.createElement("div");
  leftImage.className = "stage7-image";
  leftImage.style.cssText = `
    position: fixed;
    top: ${stage7Config.leftImage.top};
    left: ${stage7Config.leftImage.left};
    transform: translate(-50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const leftImg = document.createElement("img");
  leftImg.src = stage7Config.leftImage.src;
  leftImg.style.cssText = `
    max-width: ${stage7Config.leftImage.maxWidth};
    max-height: ${stage7Config.leftImage.maxHeight};
    object-fit: contain;
  `;
  
  leftImage.appendChild(leftImg);
  document.body.appendChild(leftImage);
  
  // 右側の画像
  const rightImage = document.createElement("div");
  rightImage.className = "stage7-image";
  rightImage.style.cssText = `
    position: fixed;
    top: ${stage7Config.rightImage.top};
    right: ${stage7Config.rightImage.right};
    transform: translate(50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const rightImg = document.createElement("img");
  rightImg.src = stage7Config.rightImage.src;
  rightImg.style.cssText = `
    max-width: ${stage7Config.rightImage.maxWidth};
    max-height: ${stage7Config.rightImage.maxHeight};
    object-fit: contain;
  `;
  
  rightImage.appendChild(rightImg);
  document.body.appendChild(rightImage);
}

// ステージ6専用画像を表示
function showStage6Images() {
  // ステージ6画像設定
  const stage6Config = {
    leftImage: {
      src: "images/のの_N.png",
      top: "45%",
      left: "16%",
      maxWidth: "29vw",
      maxHeight: "39vw"
    },
    rightImage: {
      src: "images/ミリちゃん_N.png",
      top: "52%",
      right: "18%",
      maxWidth: "18vw",
      maxHeight: "27vw"
    }
  };
  
  // 既存の画像を削除
  const existingImages = document.querySelectorAll('.stage6-image');
  existingImages.forEach(img => img.remove());
  
  // 左側の画像
  const leftImage = document.createElement("div");
  leftImage.className = "stage6-image";
  leftImage.style.cssText = `
    position: fixed;
    top: ${stage6Config.leftImage.top};
    left: ${stage6Config.leftImage.left};
    transform: translate(-50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const leftImg = document.createElement("img");
  leftImg.src = stage6Config.leftImage.src;
  leftImg.style.cssText = `
    max-width: ${stage6Config.leftImage.maxWidth};
    max-height: ${stage6Config.leftImage.maxHeight};
    object-fit: contain;
  `;
  
  leftImage.appendChild(leftImg);
  document.body.appendChild(leftImage);
  
  // 右側の画像
  const rightImage = document.createElement("div");
  rightImage.className = "stage6-image";
  rightImage.style.cssText = `
    position: fixed;
    top: ${stage6Config.rightImage.top};
    right: ${stage6Config.rightImage.right};
    transform: translate(50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const rightImg = document.createElement("img");
  rightImg.src = stage6Config.rightImage.src;
  rightImg.style.cssText = `
    max-width: ${stage6Config.rightImage.maxWidth};
    max-height: ${stage6Config.rightImage.maxHeight};
    object-fit: contain;
  `;
  
  rightImage.appendChild(rightImg);
  document.body.appendChild(rightImage);
}

// ステージ5専用画像を表示
function showStage5Images() {
  // ステージ5画像設定
  const stage5Config = {
    leftImage: {
      src: "images/このみ_N.png",
      top: "46%",
      left: "15.5%",
      maxWidth: "29vw",
      maxHeight: "39vw"
    },
    rightImage: {
      src: "images/ミリちゃん_N.png",
      top: "52%",
      right: "18%",
      maxWidth: "18vw",
      maxHeight: "27vw"
    }
  };
  
  // 既存の画像を削除
  const existingImages = document.querySelectorAll('.stage5-image');
  existingImages.forEach(img => img.remove());
  
  // 左側の画像
  const leftImage = document.createElement("div");
  leftImage.className = "stage5-image";
  leftImage.style.cssText = `
    position: fixed;
    top: ${stage5Config.leftImage.top};
    left: ${stage5Config.leftImage.left};
    transform: translate(-50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const leftImg = document.createElement("img");
  leftImg.src = stage5Config.leftImage.src;
  leftImg.style.cssText = `
    max-width: ${stage5Config.leftImage.maxWidth};
    max-height: ${stage5Config.leftImage.maxHeight};
    object-fit: contain;
  `;
  
  leftImage.appendChild(leftImg);
  document.body.appendChild(leftImage);
  
  // 右側の画像
  const rightImage = document.createElement("div");
  rightImage.className = "stage5-image";
  rightImage.style.cssText = `
    position: fixed;
    top: ${stage5Config.rightImage.top};
    right: ${stage5Config.rightImage.right};
    transform: translate(50%, -50%);
    z-index: 998;
    pointer-events: none;
  `;
  
  const rightImg = document.createElement("img");
  rightImg.src = stage5Config.rightImage.src;
  rightImg.style.cssText = `
    max-width: ${stage5Config.rightImage.maxWidth};
    max-height: ${stage5Config.rightImage.maxHeight};
    object-fit: contain;
  `;
  
  rightImage.appendChild(rightImg);
  document.body.appendChild(rightImage);
}

// ゲームオーバー画像を表示
function showGameOverImage() {
  // 既存のゲームオーバー画像を削除
  const existingImage = document.getElementById("game-over-image");
  if (existingImage) {
    existingImage.remove();
  }
  
  // 新しい画像を作成
  const imageContainer = document.createElement("div");
  imageContainer.id = "game-over-image";
  imageContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1002;
    pointer-events: none;
  `;
  
  const img = document.createElement("img");
  img.src = "images/ミリちゃん_Y1.png";
  img.style.cssText = "width: 35vw; height: auto; opacity: 1;";
  
  imageContainer.appendChild(img);
  document.body.appendChild(imageContainer);
}

// シャッフルメッセージの候補をランダムに選択
function getShuffleMessage() {
  const messages = [
    "シャッフルします",
    "カードをまぜます",
    "シャッフルタイム♪",
    "引いちゃいましたね",
    "あきらめないでくださいね",
    "間に合いますか？",
    "進捗はどうですか？",
    "ふふふ．．．"
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// 全てのカードを裏に戻す
function flipAllCardsBack() {
  const allCards = document.querySelectorAll(".card");
  allCards.forEach(card => {
    card.classList.remove("open");
  });
  
  // オンライン対戦中は観戦側に通知（観戦側からの適用時は再送しない）
  if (onlineMode && onlinePhase === 'my-turn') {
    sendOnline({ type: 'flipAll' });
  }
}

// シャッフル画像を表示
function showShuffleImage() {
  // 既存のミリちゃん画像を削除
  const existingMirichanImage = document.getElementById("mirichan-image");
  if (existingMirichanImage) {
    existingMirichanImage.remove();
  }
  
  // ミリちゃん画像を表示
  const mirichanImageContainer = document.createElement("div");
  mirichanImageContainer.id = "mirichan-image";
  mirichanImageContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1002;
    pointer-events: none;
  `;
  
  const mirichanImg = document.createElement("img");
  mirichanImg.src = "images/ミリちゃん_A.png";
  mirichanImg.style.cssText = "width: 37vw; height: auto; opacity: 1;";
  
  mirichanImageContainer.appendChild(mirichanImg);
  document.body.appendChild(mirichanImageContainer);
  
  // オンライン対戦中は観戦側にシャッフル画像を通知
  if (onlineMode && onlinePhase === 'my-turn') {
    sendOnline({ type: 'shuffleImg' });
  }
  
  // 1.0秒後に画像を削除
  setTimeout(() => {
    const mirichanImage = document.getElementById("mirichan-image");
    if (mirichanImage) {
      mirichanImage.remove();
    }
  }, 1000);
}

// カードをシャッフル
function shuffleCards() {
  const board = document.getElementById("board");
  const allChildren = Array.from(board.children);
  
  // 空きスロットの位置を記録
  const emptySlots = [];
  const cardElements = [];
  
  allChildren.forEach((child, index) => {
    if (child.classList.contains("empty-slot")) {
      emptySlots.push({element: child, index: index});
    } else {
      cardElements.push(child);
    }
  });
  
  // カードのみをシャッフル
  cardElements.sort(() => Math.random() - 0.5);
  
  // ボードをクリア
  board.innerHTML = "";
  
  // 元の位置に空きスロットを配置
  const totalElements = emptySlots.length + cardElements.length;
  for (let i = 0; i < totalElements; i++) {
    const isEmptySlot = emptySlots.some(slot => slot.index === i);
    if (isEmptySlot) {
      const emptySlot = emptySlots.find(slot => slot.index === i);
      board.appendChild(emptySlot.element);
    } else {
      const card = cardElements.shift();
      if (card) {
        board.appendChild(card);
        // イベントリスナーを再設定
        setupCardEventListeners(card);
      }
    }
  }
  
  // シャッフル後は位置番号を現在の並びで振り直す（観戦側との位置同期用）
  Array.from(board.querySelectorAll('.card')).forEach((c, i) => {
    c.dataset.position = i + 1;
  });
  
  // オンライン対戦中はシャッフル後の並びを観戦側に通知
  if (onlineMode && onlinePhase === 'my-turn') {
    const order = Array.from(board.querySelectorAll('.card')).map(c => c.dataset.value);
    sendOnline({ type: 'shuffle', order: order });
  }
}

// カードのイベントリスナーを設定する関数
function setupCardEventListeners(card) {
  const cardValue = card.dataset.value;
  
  // 既存のイベントリスナーを削除して再設定
  card.removeEventListener('click', card.handleClick);
  
  card.handleClick = function(e) {
    console.log('カードクリック:', cardValue, 'lock:', lock, 'open:', card.classList.contains("open"));
    if (lock || card.classList.contains("open")) {
      console.log('クリック無効: lock=' + lock + ', open=' + card.classList.contains("open"));
      return;
    }
    lock = true;
    card.classList.add("open");
    console.log('カードめくり実行:', cardValue);

    // オンライン対戦中は観戦側にめくりを通知
    if (onlineMode && onlinePhase === 'my-turn') {
      sendOnline({ type: 'flip', position: card.dataset.position });
    }

    if (cardValue === 'red-x' || cardValue === 'blue-x') {
      // ×カードの引いた回数を記録
      xCardCounts[cardValue] = (xCardCounts[cardValue] || 0) + 1;
      
      // 数字の昇順をリセット
      lastDrawnNumber = null;
      drawnCards = [];
      
      if (xCardCounts[cardValue] === 1) {
        // 1回目：警告メッセージ
        showXCardMessage("アクマにご注意！");
        setTimeout(() => {
          flipAllCardsBack(); // 全てのカードを裏に戻す
          lock = false;
        }, 1000);
      } else if (xCardCounts[cardValue] === 2) {
        // 2回目：シャッフルメッセージと画像
        showXCardMessage(getShuffleMessage());
        showShuffleImage();
        setTimeout(() => {
          flipAllCardsBack(); // 全てのカードを裏に戻す
          shuffleCards();
          // 全ての×カードのカウントをリセット
          xCardCounts = {};
          lock = false;
        }, 1000);
      } else {
        // 3回目以降：通常のリセット
        setTimeout(() => {
          flipAllCardsBack(); // 全てのカードを裏に戻す
          resetGame();
          lock = false;
        }, 1000);
      }
      return;
    }

    if (lastDrawnNumber === null) {
      // 最初のカード
      lastDrawnNumber = cardValue;
      drawnCards.push(cardValue); recordStreak(); // 引いたカードを記録
      lock = false;
    } else {
      // 2枚目以降のカード
      if (cardValue > lastDrawnNumber) {
        // 昇順の場合
        lastDrawnNumber = cardValue;
        drawnCards.push(cardValue); recordStreak(); // 引いたカードを記録
        
        // クリア条件のチェック：1から始まって全ての数字カードが表になっているか
        const allNumbersDrawn = drawnCards.filter(card => typeof card === 'number');
        const requiredNumbers = Array.from({length: selectedLevel}, (_, i) => i + 1);
        
        const isCompleteClear = allNumbersDrawn.length === requiredNumbers.length &&
                                requiredNumbers.every(num => allNumbersDrawn.includes(num)) &&
                                allNumbersDrawn[0] === 1;
        
        if (isCompleteClear) {
          showClearMessage();
          lock = false;
        } else {
          lock = false;
        }
      } else {
        // 昇順が途切れた場合
        setTimeout(() => {
          flipAllCardsBack(); // 全てのカードを裏に戻す
          lastDrawnNumber = null;
          drawnCards = [];
          // xCardCountsはリセットしない（×カードの進行状況を維持）
          lock = false;
        }, 1000);
      }
    }
  };
  
  card.addEventListener('click', card.handleClick);
}

function showClearMessage() {
  console.log('=== ゲームクリア処理開始 ===');
  console.log('現在時刻:', new Date().toLocaleTimeString());
  
  // カード操作をロック（チュートリアルも含む）
  lock = true;
  
  const messageDiv = document.createElement("div");
  messageDiv.id = "clear-message";

  // レベル11・12（4×4盤面）ではカードに被らないよう下端に表示
  const clearBottom = selectedLevel >= 11 ? '2%' : '5%';

  // チャレンジモードの場合はシンプルなボタンのみ
  if (challengeMode) {
    messageDiv.style.cssText = `
      position: fixed;
      bottom: ${clearBottom};
      left: 50%;
      transform: translateX(-50%);
      z-index: 1002;
    `;
  } else {
    // 通常モードの場合は装飾付き
    messageDiv.style.cssText = `
      position: fixed;
      bottom: ${clearBottom};
      left: 50%;
      transform: translateX(-50%);
      background: black;
      padding: 1.5vw 3vw;
      border-radius: 1vw;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      z-index: 1002;
      font-size: 2.8vw;
      font-weight: bold;
      font-family: 'ArmedLemon', 'JF-Dot-Kaname12', monospace;
      color: yellow;
      text-align: center;
      border: 3px solid yellow;
      white-space: pre-line;
    `;
  }
  
  // チャレンジモードの場合はボタンを表示
  if (challengeMode) {
    // 最終レベルの場合はすばらしい！、それ以外は次のステージへ
    const buttonText = (challengeCurrentLevel === challengeMaxLevel) ? 'すばらしい！' : '次のステージへ';
    const buttonAction = (challengeCurrentLevel === challengeMaxLevel) ? 'playTousenAndChangeText()' : 'challengeNextStage()';
    
    messageDiv.innerHTML = `<button class="next-stage-btn" onclick="${buttonAction}">${buttonText}</button>`;
  } else {
    messageDiv.textContent = onlineMode ? `ステージ${onlineLevel}クリア！` : `ゲームクリア！`;
  }
  
  console.log('クリアメッセージを作成しました');
  document.body.appendChild(messageDiv);
  console.log('クリアメッセージを画面に追加しました');
  
  // 全てのカードの裏面にclearedクラスを追加してHバージョン画像を表示
  const allCardBacks = document.querySelectorAll('.card-back');
  allCardBacks.forEach(cardBack => {
    cardBack.classList.add('cleared');
  });
  console.log('全てのカードをHバージョンに変更しました');
  
  // オンライン対戦中は観戦側にクリア演出を通知
  if (onlineMode && onlinePhase === 'my-turn') {
    sendOnline({ type: 'cleared', text: messageDiv.textContent });
  }
  
  // 「ゲームクリア！」のテキストが表示されたら各処理を実行
  setTimeout(() => {
    
    // 全てのカードのクリックイベントを無効化
    const allCards = document.querySelectorAll('.card');
    allCards.forEach(card => {
      card.style.pointerEvents = 'none';
      card.style.cursor = 'default';
    });
    
    // タイマーを停止
    if (timerInterval) {
      clearInterval(timerInterval);
      console.log('タイマーを停止しました');
    }
    
    // BGMを停止
    console.log('BGM停止を開始します...');
    stopBGM();
    console.log('BGM停止完了');
    
    // 背景を白に戻し、トランジションを即時適用
    document.body.style.transition = 'none';
    document.body.style.backgroundColor = 'white';
    console.log('背景を白色に戻しました');
    
    // 少し遅延してトランジションを元に戻す
    setTimeout(() => {
      document.body.style.transition = 'background-color 13s ease-in-out';
    }, 100);
    
    // 効果音を再生（chare、batuと同じ実装方法）
    console.log('クリア効果音再生を開始します...');
    playClearSound();
  }, 100); // メッセージ表示から100ms後に実行
  
  // オンライン対戦の場合は結果を送信して相手の番／集計へ
  if (onlineMode) {
    setTimeout(() => {
      onMyStageFinished('clear');
    }, 1500);
  }
  
  // 永久表示のため、削除処理をコメントアウト
  // setTimeout(() => {
  //   document.body.removeChild(messageDiv);
  // }, 5000);
}

// tousen効果音再生関数
function playTousenSound() {
  try {
    console.log('tousen効果音の再生を試みます...');
    
    const audio = new Audio();
    audio.src = 'sounds/tousen.mp3';
    audio.type = 'audio/mpeg';
    audio.volume = sfxVolume * 1.2; // 効果音音量の1.2倍（50%×1.2=60%）
    
    // 音声ファイルの読み込みを待機
    audio.addEventListener('canplaythrough', function() {
      console.log('tousen効果音の読み込み完了、再生を開始します');
      console.log('音声タイプ:', audio.type);
      console.log('音声ソース:', audio.src);
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('tousen効果音再生成功');
        }).catch(error => {
          console.log('tousen効果音の再生に失敗しました:', error);
          // 少し遅延して再試みる
          setTimeout(() => {
            audio.play();
          }, 200);
        });
      } else {
        // 古いブラウザ対応
        audio.play();
        console.log('tousen効果音再生開始（古いブラウザ）');
      }
    });
    
    // エラーハンドリング
    audio.addEventListener('error', function(e) {
      console.log('tousen効果音の読み込みエラー:', e);
      console.log('音声ファイルのパスを確認してください: sounds/tousen.mp3');
    });
    
  } catch (error) {
    console.log('tousen効果音の作成に失敗しました:', error);
  }
}

// 最終レベル用のすばらしいボタン関数
function playTousenAndChangeText() {
  // すばらしい！ボタンを無効化（1回のみ）
  event.target.disabled = true;
  
  // テキストを変更
  event.target.textContent = '全ステージクリア！おめでとう！';
  
  // 黒と黄色の装飾を追加
  event.target.style.cssText = `
    background: black;
    color: yellow;
    border: 3px solid yellow;
    padding: 1.5vw 3vw;
    border-radius: 1vw;
    font-size: 2.5vw;
    font-weight: bold;
    font-family: 'ArmedLemon', 'JF-Dot-Kaname12', monospace;
    cursor: pointer;
    margin-top: 1vw;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;
  
  // 効果音を再生
  playTousenSound();
}

function playTousenSoundAndFinish() {
  // ボタンを無効化（1回のみ）
  event.target.disabled = true;
  
  // 効果音を再生
  playTousenSound();
  
  // BGMを変更（クリア用BGMを再生）
  stopBGM();
  bgmAudio = new Audio('sounds/clear_bgm.mp3');
  bgmAudioFactor = BGM_CLEAR_FACTOR;
  bgmAudio.volume = bgmVolume * BGM_CLEAR_FACTOR;
  bgmAudio.loop = true;
  bgmAudio.play().catch(e => console.log('BGM再生エラー:', e));
}

// クリア効果音再生関数
function playClearSound() {
  try {
    console.log('クリア効果音の再生を試みます...');
    
    // chare、batuと同じ実装方法でcoingameを実装
    const audio = new Audio();
    audio.src = 'sounds/coingame.mp3';
    audio.type = 'audio/mpeg';
    audio.volume = sfxVolume; // 設定された効果音音量を使用
    
    // 音声ファイルの読み込みを待機
    audio.addEventListener('canplaythrough', function() {
      console.log('クリア効果音の読み込み完了、再生を開始します');
      console.log('音声タイプ:', audio.type);
      console.log('音声ソース:', audio.src);
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('クリア効果音再生成功');
        }).catch(error => {
          console.log('クリア効果音の再生に失敗しました:', error);
          // 少し遅延して再試みる
          setTimeout(() => {
            audio.play();
          }, 200);
        });
      } else {
        // 古いブラウザ対応
        audio.play();
        console.log('クリア効果音再生成功（古いブラウザ）');
      }
    });
    
    // 読み込みエラーの場合
    audio.addEventListener('error', function(error) {
      console.log('クリア効果音の読み込みエラー:', error);
      console.log('エラーオブジェクト:', error.target.error);
      
      // 少し遅延して再試みる
      setTimeout(() => {
        audio.play();
      }, 300);
    });
    
  } catch (error) {
    console.log('クリア効果音の作成に失敗しました:', error);
  }
}

// チャレンジモードで次のステージへ進む関数
function challengeNextStage() {
  // クリアメッセージを削除
  const clearMessage = document.getElementById("clear-message");
  if (clearMessage) {
    document.body.removeChild(clearMessage);
  }
  
  // 次のレベルへ
  challengeCurrentLevel++;
  
  // 最終レベル（12）をクリアした場合
  if (challengeCurrentLevel > challengeMaxLevel) {
    // チャレンジモードを終了
    challengeMode = false;
    
    // ゲームクリアと同じ位置（画面下部）に装飾されたテキストを表示
    const completeMessage = document.createElement('div');
    completeMessage.style.cssText = `
      position: fixed;
      bottom: 5%;
      left: 50%;
      transform: translateX(-50%);
      background: black;
      color: yellow;
      padding: 1.5vw 3vw;
      border-radius: 1vw;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      z-index: 1002;
      font-size: 2.5vw;
      font-weight: bold;
      font-family: 'JF-Dot-Kaname12', monospace;
      text-align: center;
      border: 3px solid yellow;
      white-space: pre-line;
    `;
    completeMessage.textContent = `全ステージクリア！\nおめでとう！`;
    document.body.appendChild(completeMessage);
    
    // tousen効果音を再生
    playTousenSound();
    
    return;
  }
  
  // 次のレベルをセットしてカード配置を準備
  selectedLevel = challengeCurrentLevel;
  
  // ゲームボードを準備（カード配置のみ、タイマーは開始しない）
  initializeGame();
  
  // スタートボタンを表示
  const startContainer = document.getElementById("game-start-container");
  if (startContainer) {
    startContainer.style.display = "block";
  }
}

// チャレンジモードのレベルを開始する関数
function startChallengeLevel() {
  // 準備メッセージを削除
  const messageDiv = document.querySelector('div[style*="position: fixed"]');
  if (messageDiv) {
    document.body.removeChild(messageDiv);
  }
  
  // 次のレベルをセットしてゲームを再初期化
  selectedLevel = challengeCurrentLevel;
  
  // ゲームを再初期化
  initializeGame();
  
  // タイマーを開始
  startTimer();
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', function() {
  // ホームボタン
  const homeBtn = document.getElementById('home-btn');
  if (homeBtn) {
    homeBtn.addEventListener('click', function() {
      document.getElementById('home-confirm-dialog').style.display = 'block';
    });
  }
  
  // ホーム確認ダイアログのボタン
  const confirmHome = document.getElementById('confirm-home');
  if (confirmHome) {
    confirmHome.addEventListener('click', function() {
      // 全てのリセットと初期画面に戻る
      backToStart();
      document.getElementById('home-confirm-dialog').style.display = 'none';
      
      // ページを更新して完全に初期状態に戻す
      setTimeout(() => {
        location.reload();
      }, 100);
    });
  }
  
  const cancelHome = document.getElementById('cancel-home');
  if (cancelHome) {
    cancelHome.addEventListener('click', function() {
      document.getElementById('home-confirm-dialog').style.display = 'none';
    });
  }
  
  // 音量ボタン
  const volumeBtn = document.getElementById('volume-btn');
  if (volumeBtn) {
    volumeBtn.addEventListener('click', function() {
      document.getElementById('volume-panel').style.display = 'block';
    });
  }
  
  // 音量パネルの閉じるボタン
  const closeVolumePanel = document.getElementById('close-volume-panel');
  if (closeVolumePanel) {
    closeVolumePanel.addEventListener('click', function() {
      document.getElementById('volume-panel').style.display = 'none';
    });
  }
  
  // BGM音量スライダー
  const bgmVolumeSlider = document.getElementById('bgm-volume');
  const bgmVolumeValue = document.getElementById('bgm-volume-value');
  if (bgmVolumeSlider && bgmVolumeValue) {
    bgmVolumeSlider.addEventListener('input', function() {
      bgmVolume = this.value / 100;
      bgmVolumeValue.textContent = this.value + '%';
      
      // 再生中のBGM音量を更新
      if (bgmAudio) {
        bgmAudio.volume = bgmVolume * bgmAudioFactor; // 再生中の曲に応じた係数を適用
      }
    });
  }
  
  // 効果音音量スライダー
  const sfxVolumeSlider = document.getElementById('sfx-volume');
  const sfxVolumeValue = document.getElementById('sfx-volume-value');
  if (sfxVolumeSlider && sfxVolumeValue) {
    sfxVolumeSlider.addEventListener('input', function() {
      sfxVolume = this.value / 100;
      sfxVolumeValue.textContent = this.value + '%';
    });
  }
  
  // 巻き戻しボタン
  const rewindBtn = document.getElementById('rewind-btn');
  if (rewindBtn) {
    rewindBtn.addEventListener('click', function() {
      // リセット確認ダイアログを表示
      document.getElementById('reset-confirm-dialog').style.display = 'flex';
    });
  }
  
  // リセット確認ダイアログのOKボタン
  const confirmResetBtn = document.getElementById('confirm-reset');
  if (confirmResetBtn) {
    confirmResetBtn.addEventListener('click', function() {
      // ダイアログを非表示
      document.getElementById('reset-confirm-dialog').style.display = 'none';
      
      // タイマーを停止
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      
      // ゲームをリセット
      const gameOverMessages = document.querySelectorAll('.game-over-message');
      gameOverMessages.forEach(msg => msg.remove());
      const gameOverImage = document.getElementById('game-over-image');
      if (gameOverImage) gameOverImage.remove();
      const clearMessage = document.getElementById('clear-message');
      if (clearMessage) clearMessage.remove();
      initializeGame();
      document.body.style.transition = 'none';
      document.body.style.backgroundColor = 'white';
      setTimeout(() => {
        document.body.style.transition = 'background-color 13s ease-in-out';
      }, 100);
      
      // スタートボタンを再表示
      const startContainer = document.getElementById("game-start-container");
      if (startContainer) {
        startContainer.style.display = "flex";
      }
      
      // 巻き戻しボタンを非表示
      rewindBtn.style.display = "none";
      
      // カード操作をロック
      lock = true;
      
      // タイマーをリセット
      timeRemaining = getTimeLimit();
      updateTimerDisplay();
      
      // BGMを停止
      stopBGM();
    });
  }
  
  // リセット確認ダイアログのキャンセルボタン
  const cancelResetBtn = document.getElementById('cancel-reset');
  if (cancelResetBtn) {
    cancelResetBtn.addEventListener('click', function() {
      // ダイアログを非表示
      document.getElementById('reset-confirm-dialog').style.display = 'none';
    });
  }
  
  // 遊び方ボタン
  const howToPlayBtn = document.getElementById('how-to-play-btn');
  if (howToPlayBtn) {
    howToPlayBtn.addEventListener('click', function() {
      // 遊び方ダイアログを表示
      document.getElementById('how-to-play-dialog').style.display = 'flex';
      // 1ページ目を表示
      showHowToPlayPage(1);
    });
  }
  
  // 遊び方ダイアログの閉じるボタン
  const closeHowToPlayBtn = document.getElementById('close-how-to-play');
  if (closeHowToPlayBtn) {
    closeHowToPlayBtn.addEventListener('click', function() {
      document.getElementById('how-to-play-dialog').style.display = 'none';
    });
  }
  
  // 遊び方ダイアログのページ切り替え
  let currentPage = 1;
  const totalPages = 3;
  
  function showHowToPlayPage(page) {
    currentPage = page;
    document.getElementById('how-to-play-page-1').style.display = page === 1 ? 'block' : 'none';
    document.getElementById('how-to-play-page-2').style.display = page === 2 ? 'block' : 'none';
    document.getElementById('how-to-play-page-3').style.display = page === 3 ? 'block' : 'none';
    document.getElementById('page-indicator').textContent = `${page} / ${totalPages}`;
    document.getElementById('prev-page').disabled = page === 1;
    document.getElementById('next-page').disabled = page === totalPages;
  }
  
  const prevPageBtn = document.getElementById('prev-page');
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', function() {
      if (currentPage > 1) {
        showHowToPlayPage(currentPage - 1);
      }
    });
  }
  
  const nextPageBtn = document.getElementById('next-page');
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', function() {
      if (currentPage < totalPages) {
        showHowToPlayPage(currentPage + 1);
      }
    });
  }
  
  // クレジットボタン
  const creditBtn = document.getElementById('credit-btn');
  if (creditBtn) {
    creditBtn.addEventListener('click', function() {
      // クレジットダイアログを表示
      document.getElementById('credit-dialog').style.display = 'flex';
    });
  }
  
  // クレジットダイアログの閉じるボタン
  const closeCreditBtn = document.getElementById('close-credit');
  if (closeCreditBtn) {
    closeCreditBtn.addEventListener('click', function() {
      document.getElementById('credit-dialog').style.display = 'none';
    });
  }
  
});

// =====================
// オンライン対戦
// =====================

// ルームコード生成（紛らわしい文字を除外した4文字）
function generateRoomCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ロビーメニューのステータス表示
function setOnlineMenuStatus(text) {
  const el = document.getElementById('online-menu-status');
  if (el) el.textContent = text;
}

// 待機画面のステータス表示
function setOnlineLobbyStatus(text) {
  const el = document.getElementById('online-status-text');
  if (el) el.textContent = text;
}

// ニックネーム入力欄の値（空なら自動命名）
function readNicknameInput() {
  const el = document.getElementById('nickname-input');
  return el ? el.value.trim().slice(0, 10) : '';
}

// 自分の表示名（未設定なら先攻=プレイヤー1／後攻=プレイヤー2）
function myDisplayName() {
  return readNicknameInput() || (isOnlineHost ? 'プレイヤー1' : 'プレイヤー2');
}

// 相手の表示名（未受信ならデフォルト名）
function peerDisplayName() {
  return peerNickname || (isOnlineHost ? 'プレイヤー2' : 'プレイヤー1');
}

// 自分のニックネームを相手へ送信（1回のみ）
function sendMyName() {
  if (nameSent) return;
  nameSent = true;
  sendOnline({ type: 'name', name: myDisplayName() });
}

// 相手ターン中などのオーバーレイ表示
function showOnlineOverlay(text, mode) {
  const overlay = document.getElementById('online-overlay');
  document.getElementById('online-overlay-text').textContent = text;
  overlay.style.display = 'block';
  onlineOverlayMode = mode || null;
}

// 名前受信後にオーバーレイ文言を再生成する
function refreshOnlineOverlay() {
  if (!onlineOverlayMode) return;
  const peerRole = isOnlineHost ? '後攻' : '先攻';
  if (onlineOverlayMode === 'peer-turn') {
    showOnlineOverlay(`ステージ${onlineLevel}\n${peerDisplayName()}（${peerRole}）の番です…`, 'peer-turn');
  } else if (onlineOverlayMode === 'my-done-wait') {
    showOnlineOverlay(`${peerDisplayName()}（${peerRole}）がプレイ中です…`, 'my-done-wait');
  } else if (onlineOverlayMode === 'result-wait') {
    showOnlineOverlay('結果を集計中…', 'result-wait');
  }
}

function hideOnlineOverlay() {
  const overlay = document.getElementById('online-overlay');
  if (overlay) overlay.style.display = 'none';
  onlineOverlayMode = null;
}

// 対戦中のステータスバー更新
function updateOnlineStatus(phaseText) {
  const bar = document.getElementById('online-status-bar');
  if (!bar) return;
  bar.textContent = `${myDisplayName()} vs ${peerDisplayName()}`;
}

// 結果の日本語ラベル
function resultLabel(result) {
  return result === 'clear' ? 'クリア' : 'ゲームオーバー';
}

// 結果＋成績の詳細ラベル（ゲームオーバー時は連続数と残り時間を併記）
function resultDetail(result, streak, streakTime) {
  if (result === 'clear') return 'クリア';
  if (typeof streak === 'number') {
    return `ゲームオーバー（${streak}連続・残り${streakTime}秒）`;
  }
  return 'ゲームオーバー';
}

// 片方終了時の結果ブロック（名前の結果＋クリア/ゲームオーバー＋ゲームオーバー時のみ成績行）
function resultBlock(name, result, streak, streakTime) {
  let t = `${name}の結果\n${result === 'clear' ? 'ゲームクリア！' : 'ゲームオーバー'}`;
  if (result !== 'clear' && typeof streak === 'number') {
    t += `\n${streak}人目：残り${streakTime}秒`;
  }
  return t;
}

// ステージ結果バナー（指定ミリ秒後に自動消去）
function showOnlineResultBanner(text, duration) {
  document.querySelectorAll('.online-result-banner').forEach(e => e.remove());
  const banner = document.createElement('div');
  banner.className = 'online-result-banner';
  banner.textContent = text;
  document.body.appendChild(banner);
  if (duration) {
    setTimeout(() => banner.remove(), duration);
  }
}

// オンラインロビーを表示
function showOnlineMenu() {
  document.getElementById('level-selection-screen').style.display = 'none';
  document.getElementById('online-lobby-screen').style.display = 'flex';
  document.getElementById('online-menu').style.display = 'flex';
  document.getElementById('online-waiting').style.display = 'none';
  setOnlineMenuStatus('');
}

// ロビーを閉じてレベル選択へ戻る
function hideOnlineMenu() {
  cleanupOnline();
  document.getElementById('online-lobby-screen').style.display = 'none';
  document.getElementById('level-selection-screen').style.display = 'flex';
}

// ロビーの待機状態をキャンセルしてメニューに戻る
function cancelOnline() {
  cleanupOnline();
  document.getElementById('online-waiting').style.display = 'none';
  document.getElementById('online-menu').style.display = 'flex';
}

// Peer接続のみ破棄
function cleanupPeerOnly() {
  if (lobbyRescanTimer) {
    clearTimeout(lobbyRescanTimer);
    lobbyRescanTimer = null;
  }
  lobbyProbing = false;
  lobbySlotId = null;
  if (autoMatchProbe && autoMatchProbe !== onlinePeer) {
    try { autoMatchProbe.destroy(); } catch (e) {}
  }
  autoMatchProbe = null;
  if (onlineConn) {
    try { onlineConn.close(); } catch (e) {}
    onlineConn = null;
  }
  if (onlinePeer) {
    try { onlinePeer.destroy(); } catch (e) {}
    onlinePeer = null;
  }
  peerNickname = '';
  nameSent = false;
}

// オンライン対戦状態を完全にクリーンアップ
function cleanupOnline() {
  cleanupPeerOnly();
  onlineMode = false;
  isOnlineHost = false;
  onlinePhase = 'idle';
  spectatorLayout = null;
  peerNickname = '';
  nameSent = false;
  onlineStatusPhase = '';
  pendingMatchStart = false;
  hideVsScreen();
  hideOnlineOverlay();
  const bar = document.getElementById('online-status-bar');
  if (bar) bar.style.display = 'none';
  hideChatPanel();
  const chatLog = document.getElementById('chat-log');
  if (chatLog) chatLog.innerHTML = '';
  document.querySelectorAll('.online-end-overlay, .online-result-banner, .online-stage-result').forEach(e => e.remove());
}

// ルーム作成（ホスト側）
function createRoom() {
  if (typeof Peer === 'undefined') {
    setOnlineMenuStatus('通信ライブラリの読み込みに失敗しています');
    return;
  }
  cleanupPeerOnly();
  const code = generateRoomCode();
  isOnlineHost = true;
  onlinePhase = 'lobby';
  
  // コードをそのままPeerIDとして使用
  onlinePeer = new Peer(ONLINE_PEER_PREFIX + code);
  
  onlinePeer.on('open', () => {
    document.getElementById('online-menu').style.display = 'none';
    document.getElementById('online-waiting').style.display = 'flex';
    document.getElementById('online-waiting-label').style.display = 'block';
    const codeDisplay = document.getElementById('room-code-display');
    codeDisplay.style.display = 'block';
    codeDisplay.textContent = code;
    setOnlineLobbyStatus('相手の参加を待っています…');
  });
  
  onlinePeer.on('connection', (c) => {
    if (onlineConn) return; // 先着1名のみ
    onlineConn = c;
    setupOnlineConnection();
    c.on('open', () => {
      waitForNameThenStart();
    });
  });
  
  onlinePeer.on('error', (err) => {
    console.log('PeerJSエラー:', err);
    if (onlinePhase === 'lobby') {
      setOnlineLobbyStatus('エラーが発生しました: ' + err.type);
    }
  });
}

// ルーム参加（ゲスト側）
function joinRoom() {
  if (typeof Peer === 'undefined') {
    setOnlineMenuStatus('通信ライブラリの読み込みに失敗しています');
    return;
  }
  const input = document.getElementById('room-code-input');
  const code = (input.value || '').trim().toUpperCase();
  if (code.length !== 4) {
    setOnlineMenuStatus('4文字のコードを入力してください');
    return;
  }
  
  cleanupPeerOnly();
  isOnlineHost = false;
  onlinePhase = 'lobby';
  onlinePeer = new Peer();
  
  onlinePeer.on('open', () => {
    onlineConn = onlinePeer.connect(ONLINE_PEER_PREFIX + code, { reliable: true });
    setupOnlineConnection();
    onlineConn.on('open', () => {
      sendMyName();
      setOnlineLobbyStatus('接続しました！対戦準備中…');
    });
  });
  
  // 待機UIへ切り替え（コード表示はホストのみ）
  document.getElementById('online-menu').style.display = 'none';
  document.getElementById('online-waiting').style.display = 'flex';
  document.getElementById('online-waiting-label').style.display = 'none';
  document.getElementById('room-code-display').style.display = 'none';
  setOnlineLobbyStatus('接続中…');
  
  onlinePeer.on('error', (err) => {
    console.log('PeerJSエラー:', err);
    if (onlinePhase !== 'lobby') return;
    cancelOnline();
    if (err.type === 'peer-unavailable') {
      setOnlineMenuStatus('ルームが見つかりませんでした');
    } else {
      setOnlineMenuStatus('接続エラー: ' + err.type);
    }
  });
}

// データ接続のイベント設定
function setupOnlineConnection() {
  onlineConn.on('data', handleOnlineMessage);
  onlineConn.on('close', onOnlineDisconnected);
  onlineConn.on('error', (e) => {
    console.log('接続エラー:', e);
    onOnlineDisconnected();
  });
}

// 相手からのメッセージ送信
function sendOnline(msg) {
  if (onlineConn && onlineConn.open) {
    onlineConn.send(msg);
  }
}

// 切断時の処理
function onOnlineDisconnected() {
  if (onlinePhase === 'ended' || onlinePhase === 'idle') return;
  if (onlinePhase === 'lobby') {
    cancelOnline();
    setOnlineMenuStatus('相手との接続が切れました');
    return;
  }
  onlinePhase = 'ended';
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  stopBGM();
  hideOnlineOverlay();
  hideVsScreen();
  showOnlineEndScreen('通信切断', '相手との接続が切れました');
}

// VS画面（先攻 vs 後攻）を5秒間表示
function showVsScreen() {
  document.querySelectorAll('.vs-screen').forEach(e => e.remove());
  vsScreenActive = true;
  const div = document.createElement('div');
  div.className = 'vs-screen';
  div.innerHTML = `
    <div class="vs-name" id="vs-name-first"></div>
    <div class="vs-mark">VS</div>
    <div class="vs-name" id="vs-name-second"></div>
  `;
  document.body.appendChild(div);
  updateVsNames();
}

// VS画面の名前を最新のニックネームで更新（左=先攻／右=後攻）
function updateVsNames() {
  const first = document.getElementById('vs-name-first');
  const second = document.getElementById('vs-name-second');
  if (!first || !second) return;
  first.textContent = isOnlineHost ? myDisplayName() : peerDisplayName();
  second.textContent = isOnlineHost ? peerDisplayName() : myDisplayName();
}

function hideVsScreen() {
  vsScreenActive = false;
  if (vsScreenTimeout) {
    clearTimeout(vsScreenTimeout);
    vsScreenTimeout = null;
  }
  document.querySelectorAll('.vs-screen').forEach(e => e.remove());
}

// VS表示後にステージを開始する
function startVsThenStage(level) {
  showVsScreen();
  vsScreenTimeout = setTimeout(() => {
    hideVsScreen();
    startOnlineStage(level);
    const notice = document.createElement('div');
    notice.className = 'online-result-banner online-role-notice';
    notice.textContent = `あなたは${isOnlineHost ? '先攻' : '後攻'}です！`;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 2000);
  }, 5000);
}

// 相手のニックネームを受信してから対戦開始（受信済みor2秒経過で即開始）
function waitForNameThenStart() {
  if (peerNickname) {
    startOnlineMatch();
    return;
  }
  pendingMatchStart = true;
  setTimeout(() => {
    if (pendingMatchStart) {
      pendingMatchStart = false;
      startOnlineMatch();
    }
  }, 2000);
}

// 対戦開始（ホスト側）
function startOnlineMatch() {
  pendingMatchStart = false;
  onlineMode = true;
  challengeMode = false;
  onlineLevel = ONLINE_START_LEVEL;
  document.getElementById('online-lobby-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'flex';
  document.getElementById('online-status-bar').style.display = 'block';
  document.getElementById('chat-btn').style.display = 'flex';
  sendOnline({ type: 'start', level: onlineLevel });
  startVsThenStage(onlineLevel);
}

// ステージ開始（両者共通：盤面を用意して自分の番ならスタートボタンを出す）
function startOnlineStage(level) {
  onlineLevel = level;
  selectedLevel = level;
  myOnlineResult = null;
  spectatorLayout = null;
  
  // 前ステージの表示物を掃除
  document.querySelectorAll('.game-over-message, #game-over-image, #clear-message, #x-message, #mirichan-image').forEach(e => e.remove());
  
  initializeGame();
  
  // 背景を白に戻す
  document.body.style.transition = 'none';
  document.body.style.backgroundColor = 'white';
  setTimeout(() => {
    document.body.style.transition = 'background-color 13s ease-in-out';
  }, 100);
  
  updateOnlineStatus();
  
  if (isOnlineHost) {
    // ホストは常に先攻
    onlinePhase = 'my-turn';
    hideOnlineOverlay();
    showOnlineResultBanner(`ステージ${level}\n${myDisplayName()}の番です（先攻）`, 2000);
    document.getElementById('game-start-container').style.display = 'block';
    updateOnlineStatus('先攻の番');
  } else {
    // ゲストは相手のプレイを待つ
    onlinePhase = 'opponent-turn';
    document.getElementById('game-start-container').style.display = 'none';
    hideOnlineOverlay();
    updateOnlineStatus('先攻の番');
  }
}

// 相手の盤面を再現して観戦表示（めくりイベントは別途反映）
function renderSpectatorBoard(layout) {
  spectatorLayout = JSON.stringify(layout);
  const board = document.getElementById('board');
  board.innerHTML = '';
  board.classList.add('spectating');
  
  layout.forEach((cardValue, index) => {
    const card = createCardElement(cardValue, index);
    board.appendChild(card);
  });
  
  // 空きスロットを追加
  const totalSlots = getTotalSlots(onlineLevel);
  for (let i = layout.length; i < totalSlots; i++) {
    const emptySlot = document.createElement('div');
    emptySlot.className = 'empty-slot';
    board.appendChild(emptySlot);
  }
}

// 相手のプレイイベントを観戦盤面に反映するか判定
function isSpectating() {
  return onlineMode && (onlinePhase === 'opponent-turn' || onlinePhase === 'waiting-result');
}

// プレイ中の状態をスナップショットとして相手に送信（毎秒）
function sendOnlineSnapshot() {
  const board = document.getElementById('board');
  const cards = board ? Array.from(board.querySelectorAll('.card')) : [];
  const xmsg = document.getElementById('x-message');
  const clearMsg = document.getElementById('clear-message');
  const goMsg = document.querySelector('.game-over-message');
  sendOnline({
    type: 'tick',
    time: timeRemaining,
    layout: cards.map(c => c.dataset.value),
    open: cards.filter(c => c.classList.contains('open')).map(c => c.dataset.position),
    cleared: document.querySelectorAll('.card-back.cleared').length > 0,
    xmsg: xmsg ? xmsg.textContent : null,
    clearMsg: clearMsg ? clearMsg.textContent : null,
    goMsg: goMsg ? goMsg.textContent : null
  });
}

// 観戦側：スナップショットを盤面・表示に反映（ずれを自動修復）
function applyOnlineSnapshot(msg) {
  // タイマー表示を相手と同じに
  const timerText = document.getElementById('timer-text');
  if (timerText && typeof msg.time === 'number') {
    const m = Math.floor(msg.time / 60);
    const s = msg.time % 60;
    timerText.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    // 残り10秒で背景を黒く（プレイヤー側と同じ演出）
    document.body.style.backgroundColor = msg.time <= 10 ? 'black' : 'white';
  }
  
  // レイアウトが変わっていれば描き直し（シャッフル反映）
  const layoutStr = JSON.stringify(msg.layout);
  if (layoutStr !== spectatorLayout) {
    renderSpectatorBoard(msg.layout);
  }
  
  // めくり状態を反映
  document.querySelectorAll('#board .card').forEach(c => {
    const shouldBeOpen = msg.open.includes(c.dataset.position);
    c.classList.toggle('open', shouldBeOpen);
  });
  
  // クリア状態（Hバージョン画像）
  if (msg.cleared) {
    document.querySelectorAll('.card-back').forEach(cb => cb.classList.add('cleared'));
  }
  
  // ×メッセージ
  const currentX = document.getElementById('x-message');
  if (msg.xmsg) {
    if (!currentX || currentX.textContent !== msg.xmsg) {
      showXCardMessage(msg.xmsg);
    }
  } else if (currentX) {
    currentX.remove();
  }
  
  // クリアメッセージ
  if (msg.clearMsg && !document.getElementById('clear-message')) {
    showSpectatorClearMessage(msg.clearMsg);
  }
  
  // ゲームオーバーメッセージ＆画像
  if (msg.goMsg && !document.querySelector('.game-over-message')) {
    const goDiv = document.createElement('div');
    goDiv.className = 'game-over-message';
    goDiv.textContent = msg.goMsg;
    if (onlineLevel >= 11) goDiv.style.bottom = '2%';
    document.body.appendChild(goDiv);
    showGameOverImage();
  }
}

// 観戦側：クリアメッセージをプレイヤー側と同じ装飾で表示
function showSpectatorClearMessage(text) {
  const existing = document.getElementById('clear-message');
  if (existing) existing.remove();
  
  const messageDiv = document.createElement('div');
  messageDiv.id = 'clear-message';
  const specClearBottom = onlineLevel >= 11 ? '2%' : '5%';
  messageDiv.style.cssText = `
    position: fixed;
    bottom: ${specClearBottom};
    left: 50%;
    transform: translateX(-50%);
    background: black;
    padding: 1.5vw 3vw;
    border-radius: 1vw;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    z-index: 1002;
    font-size: 2.8vw;
    font-weight: bold;
    font-family: 'ArmedLemon', 'JF-Dot-Kaname12', monospace;
    color: yellow;
    text-align: center;
    border: 3px solid yellow;
    white-space: pre-line;
  `;
  messageDiv.textContent = text;
  document.body.appendChild(messageDiv);
}

// 結果表示（終了から2.5秒後・最前面・3秒間表示）
function showStageResult(name, result, streak, streakTime) {
  if (!onlineMode || onlinePhase === 'ended') return;
  // 結果表示時は背景の暗転を解除して白に戻す
  document.body.style.transition = 'none';
  document.body.style.backgroundColor = 'white';
  setTimeout(() => {
    document.body.style.transition = 'background-color 13s ease-in-out';
  }, 100);
  document.querySelectorAll('.online-stage-result').forEach(e => e.remove());
  const div = document.createElement('div');
  div.className = 'online-stage-result';
  div.textContent = resultBlock(name, result, streak, streakTime);
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// 自分のステージプレイが終了したときの処理
function onMyStageFinished(result) {
  if (!onlineMode || onlinePhase === 'ended') return;
  myOnlineResult = result;
  myOnlineStreak = bestStreak;
  myOnlineStreakTime = bestStreakTime;
  document.getElementById('game-start-container').style.display = 'none';
  
  if (isOnlineHost) {
    // 先攻終了→相手の番を通知して結果を待つ
    sendOnline({ type: 'hostFinished', level: onlineLevel, result: result, streak: myOnlineStreak, streakTime: myOnlineStreakTime });
    onlinePhase = 'opponent-turn';
  } else {
    // 後攻終了→結果をホストに送って集計を待つ
    sendOnline({ type: 'guestResult', level: onlineLevel, result: result, streak: myOnlineStreak, streakTime: myOnlineStreakTime });
    onlinePhase = 'waiting-result';
  }
  hideOnlineOverlay();
  // 2.5秒後に結果を最前面表示（3秒間）
  setTimeout(() => showStageResult(myDisplayName(), result, myOnlineStreak, myOnlineStreakTime), 2500);
}

// ステージ結果の判定（ホストのみ実行）
function resolveOnlineStage(guestResult, guestStreak, guestStreakTime) {
  const hostResult = myOnlineResult;
  const hostStreak = myOnlineStreak;
  const hostStreakTime = myOnlineStreakTime;
  
  // 判定メッセージに含める成績
  const stats = {
    hostStreak: hostStreak,
    hostStreakTime: hostStreakTime,
    guestStreak: guestStreak,
    guestStreakTime: guestStreakTime
  };
  
  if (hostResult === 'clear' && guestResult === 'clear') {
    if (onlineLevel >= ONLINE_MAX_LEVEL) {
      // 両者が最終レベルをクリア→引き分け
      sendOnline({ type: 'matchEnd', outcome: 'draw', level: onlineLevel, hostResult: hostResult, guestResult: guestResult, ...stats });
      endOnlineMatch('draw');
    } else {
      // 両者クリア→レベルアップ
      sendOnline({ type: 'stageNext', level: onlineLevel + 1, hostResult: hostResult, guestResult: guestResult, ...stats });
      showOnlineResultBanner(`両者クリア！\n次のステージへ`, 2000);
      setTimeout(() => startOnlineStage(onlineLevel + 1), 2200);
    }
  } else if (hostResult !== guestResult) {
    // 片方のみクリア→決着
    const winner = hostResult === 'clear' ? 'host' : 'guest';
    sendOnline({ type: 'matchEnd', outcome: winner, level: onlineLevel, hostResult: hostResult, guestResult: guestResult, ...stats });
    endOnlineMatch(winner);
  } else {
    // 両者ゲームオーバー→①連続めくり数 ②達成時の残り時間 で勝敗を決定
    let outcome;
    if (hostStreak !== guestStreak) {
      outcome = hostStreak > guestStreak ? 'host' : 'guest';
    } else if (hostStreakTime !== guestStreakTime) {
      outcome = hostStreakTime > guestStreakTime ? 'host' : 'guest';
    } else {
      outcome = 'draw';
    }
    sendOnline({ type: 'matchEnd', outcome: outcome, level: onlineLevel, hostResult: hostResult, guestResult: guestResult, ...stats });
    endOnlineMatch(outcome);
  }
}

// 対戦終了画面
function endOnlineMatch(outcome) {
  onlinePhase = 'ended';
  hideOnlineOverlay();
  hideVsScreen();
  document.querySelectorAll('.game-over-message, #game-over-image, #clear-message, #x-message').forEach(e => e.remove());
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  stopBGM();
  
  const iWon = (outcome === 'host' && isOnlineHost) || (outcome === 'guest' && !isOnlineHost);
  const title = outcome === 'draw' ? '引き分け' : (iWon ? `${myDisplayName()}の勝ち！` : `${myDisplayName()}の負け…`);
  
  showOnlineEndScreen(title, `ステージ${onlineLevel}で決着`);
  
  if (iWon) {
    playTousenSound();
  }
}

// 対戦終了・切断時の全画面パネル
function showOnlineEndScreen(title, subtitle) {
  document.querySelectorAll('.online-end-overlay').forEach(e => e.remove());
  
  const overlay = document.createElement('div');
  overlay.className = 'online-end-overlay';
  
  const panel = document.createElement('div');
  panel.className = 'online-end-panel';
  
  const heading = document.createElement('h2');
  heading.textContent = title;
  panel.appendChild(heading);
  
  const sub = document.createElement('p');
  sub.textContent = subtitle;
  panel.appendChild(sub);
  
  const homeBtn = document.createElement('button');
  homeBtn.textContent = 'ホームに戻る';
  homeBtn.onclick = () => location.reload();
  panel.appendChild(homeBtn);
  
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

// 相手からのメッセージ処理
function handleOnlineMessage(msg) {
  if (!msg || !msg.type) return;
  console.log('オンラインメッセージ受信:', msg);
  
  switch (msg.type) {
    case 'start': // ゲスト側：対戦開始
      if (isOnlineHost) break;
      onlineMode = true;
      challengeMode = false;
      onlineLevel = msg.level;
      document.getElementById('online-lobby-screen').style.display = 'none';
      document.getElementById('game-container').style.display = 'flex';
      document.getElementById('online-status-bar').style.display = 'block';
      document.getElementById('chat-btn').style.display = 'flex';
      startVsThenStage(msg.level);
      break;
      
    case 'hostFinished': // ゲスト側：先攻終了→2.5秒後に結果表示（3秒）→自分の番
      if (isOnlineHost || msg.level !== onlineLevel) break;
      // 2.5秒後に先攻の結果を最前面表示（観戦中の相手盤面はそのまま見せる）
      setTimeout(() => showStageResult(peerDisplayName(), msg.result, msg.streak, msg.streakTime), 2500);
      // 結果表示が消えた頃に自分の番を開始
      setTimeout(() => {
        if (onlinePhase !== 'opponent-turn') return;
        onlinePhase = 'my-turn';
        hideOnlineOverlay();
        // 観戦用に表示していた相手の盤面を自分の盤面に差し替え
        spectatorLayout = null;
        document.querySelectorAll('.game-over-message, #game-over-image, #clear-message, #x-message').forEach(e => e.remove());
        initializeGame();
        document.body.style.transition = 'none';
        document.body.style.backgroundColor = 'white';
        setTimeout(() => {
          document.body.style.transition = 'background-color 13s ease-in-out';
        }, 100);
        showOnlineResultBanner(`${myDisplayName()}の番です（後攻）`, 2500);
        document.getElementById('game-start-container').style.display = 'block';
        updateOnlineStatus('後攻の番');
      }, 5500);
      break;
      
    case 'turnLayout': // 観戦側：相手の盤面レイアウトを受信
      if (!isSpectating() || msg.level !== onlineLevel) break;
      // 自分のプレイ終了時に残ったメッセージ・画像を消してから観戦表示へ
      document.querySelectorAll('.game-over-message, #game-over-image, #clear-message, #x-message, #mirichan-image').forEach(e => e.remove());
      renderSpectatorBoard(msg.layout);
      hideOnlineOverlay();
      updateOnlineStatus(`${isOnlineHost ? '後攻' : '先攻'}がプレイ中`);
      // 自分のゲームオーバー等で黒くなった背景を即座に白へ戻す
      document.body.style.transition = 'none';
      document.body.style.backgroundColor = 'white';
      setTimeout(() => {
        document.body.style.transition = 'background-color 13s ease-in-out';
      }, 100);
      break;
      
    case 'flip': // 観戦側：カードをめくる
      if (!isSpectating()) break;
      {
        const specCard = document.querySelector(`#board .card[data-position="${msg.position}"]`);
        if (specCard && !specCard.classList.contains('open')) {
          specCard.classList.add('open');
        }
      }
      break;
      
    case 'flipAll': // 観戦側：全カードを裏に戻す
      if (!isSpectating()) break;
      flipAllCardsBack();
      break;
      
    case 'shuffle': // 観戦側：シャッフル後の並びに差し替え
      if (!isSpectating()) break;
      renderSpectatorBoard(msg.order);
      break;
      
    case 'tick': // 観戦側：定期スナップショットで全体を同期
      if (!isSpectating()) break;
      applyOnlineSnapshot(msg);
      break;
      
    case 'xmsg': // 観戦側：×カード等のメッセージを同じ表示で再現
      if (!isSpectating()) break;
      showXCardMessage(msg.text);
      break;
      
    case 'shuffleImg': // 観戦側：シャッフル画像を再現
      if (!isSpectating()) break;
      showShuffleImage();
      break;
      
    case 'cleared': // 観戦側：クリア演出（Hバージョン画像＋メッセージ＋効果音）
      if (!isSpectating()) break;
      document.querySelectorAll('.card-back').forEach(cb => cb.classList.add('cleared'));
      if (msg.text) showSpectatorClearMessage(msg.text);
      playClearSound();
      break;
      
    case 'gameover': // 観戦側：ゲームオーバー演出（メッセージ＋画像＋効果音）
      if (!isSpectating()) break;
      if (!document.querySelector('.game-over-message')) {
        const goDiv = document.createElement('div');
        goDiv.className = 'game-over-message';
        goDiv.textContent = 'ゲームオーバー';
        if (onlineLevel >= 11) goDiv.style.bottom = '2%';
        document.body.appendChild(goDiv);
      }
      showGameOverImage();
      playGameOverSound();
      break;
      
    case 'guestResult': // ホスト側：後攻の結果を受信→2.5秒後に結果表示（3秒）→判定
      if (!isOnlineHost || onlinePhase !== 'opponent-turn' || msg.level !== onlineLevel) break;
      setTimeout(() => showStageResult(peerDisplayName(), msg.result, msg.streak, msg.streakTime), 2500);
      setTimeout(() => resolveOnlineStage(msg.result, msg.streak, msg.streakTime), 5500);
      break;
      
    case 'stageNext': // ゲスト側：両者クリア→次ステージへ
      if (isOnlineHost) break;
      showOnlineResultBanner(`両者クリア！\n次のステージへ`, 2000);
      setTimeout(() => startOnlineStage(msg.level), 2200);
      break;
      
    case 'matchEnd': // ゲスト側：対戦終了
      if (isOnlineHost) break;
      endOnlineMatch(msg.outcome);
      break;
      
    case 'name': // 相手のニックネーム受信
      peerNickname = msg.name || '';
      if (isOnlineHost) sendMyName(); // ホストは受信をトリガーに返信
      if (pendingMatchStart) {
        startOnlineMatch();
      } else if (onlineMode) {
        updateOnlineStatus();
        refreshOnlineOverlay();
        if (vsScreenActive) updateVsNames();
      }
      break;
      
    case 'chat': // 相手からのチャットメッセージ
      if (!onlineMode) break;
      displayChatMessage('peer', msg.text);
      break;
  }
}

// =====================
// チャット（定型文）
// =====================
const ONLINE_CHAT_PHRASES = {
  greeting: [
    'こんみり～！',
    'おつみり～！',
    'こんがお～！',
    'おつがお～！',
    'こんのの～！',
    'おつのの～！',
    'こんびび～！',
    'おつびび～！',
    'こんらこ～！',
    'おつらこ～！',
    'こんゆら～！',
    'おつゆら～！',
    'こんこま～！',
    'おつこま～！',
    'こんつく～！',
    'おつくり～！',
    'まよこ～ん！',
    'おつかえる～！',
    'こんぬふ～！',
    'おつぬふ～！',
    'こんれい～！',
    'おつかレイ！',
    'こんまほ～！',
    'おつかの～！',
    'ぽはよ～！',
    'おつかめ～！'
  ],
  comment: [
    'よろしくお願いします！',
    'ありがとうございました！',
    'きちゃ！',
    'がんばれ！',
    'ナイス！',
    'ファイト！',
    'PON！',
    'ｗｗｗ',
    'やばいっ！',
    'ミリちゃん！？',
    '進捗どうですか？',
    'ふふっ…',
    'うわぁぁぁぁ！',
    'くっ、くる…！'
  ]
};
let chatCurrentTab = 'greeting';

// あいさつ定型文の背景色（ミリ=紫、がお〜ぼはよは1〜12人目のカード色に対応）
const ONLINE_CHAT_PHRASE_COLORS = {
  'こんみり～！': '#9333ea',
  'こんがお～！': '#c0edf0',
  'こんのの～！': '#d4d1ff',
  'こんびび～！': '#b2405d',
  'こんらこ～！': '#ffdf5c',
  'こんゆら～！': '#9BB7E9',
  'こんこま～！': '#ffab57',
  'こんつく～！': '#DFB5FF',
  'まよこ～ん！': '#63a4a4',
  'こんぬふ～！': '#F5B7B7',
  'こんれい～！': '#5E89D9',
  'こんまほ～！': '#f9a8d4',
  'ぽはよ～！': '#86efac',
  'おつみり～！': '#9333ea',
  'おつがお～！': '#c0edf0',
  'おつのの～！': '#d4d1ff',
  'おつびび～！': '#b2405d',
  'おつらこ～！': '#ffdf5c',
  'おつゆら～！': '#9BB7E9',
  'おつこま～！': '#ffab57',
  'おつくり～！': '#DFB5FF',
  'おつかえる～！': '#63a4a4',
  'おつぬふ～！': '#F5B7B7',
  'おつかレイ！': '#5E89D9',
  'おつかの～！': '#f9a8d4',
  'おつかめ～！': '#86efac'
};
// 背景が濃い定型文は文字を白くする
const ONLINE_CHAT_DARK_BGS = ['#9333ea', '#b2405d', '#63a4a4', '#5E89D9'];

// 選択中タブの定型文ボタンを描画
function renderChatPhrases() {
  const list = document.getElementById('chat-phrase-list');
  if (!list) return;
  list.innerHTML = '';
  ONLINE_CHAT_PHRASES[chatCurrentTab].forEach(phrase => {
    const btn = document.createElement('button');
    btn.className = 'chat-phrase-btn';
    btn.textContent = phrase;
    btn.onclick = () => sendChat(phrase);
    const bg = ONLINE_CHAT_PHRASE_COLORS[phrase];
    if (bg) {
      btn.style.background = bg;
      if (ONLINE_CHAT_DARK_BGS.includes(bg)) btn.style.color = 'white';
    }
    list.appendChild(btn);
  });
}

// タブ切替（あいさつ / コメント）
function switchChatTab(tab) {
  chatCurrentTab = tab;
  document.getElementById('chat-tab-greeting').classList.toggle('active', tab === 'greeting');
  document.getElementById('chat-tab-comment').classList.toggle('active', tab === 'comment');
  renderChatPhrases();
}

// チャットパネルの表示切替
function toggleChatPanel() {
  const panel = document.getElementById('chat-panel');
  if (panel.style.display === 'none') {
    switchChatTab(chatCurrentTab);
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

function hideChatPanel() {
  const panel = document.getElementById('chat-panel');
  if (panel) panel.style.display = 'none';
}

// 定型文を選択して送信
function sendChat(text) {
  displayChatMessage('self', text);
  sendOnline({ type: 'chat', text: text });
  hideChatPanel();
}

// チャットメッセージを左下のログに追加（上に積み上がる、数秒で消える）
function displayChatMessage(who, text) {
  const log = document.getElementById('chat-log');
  if (!log) return;
  const el = document.createElement('div');
  el.className = 'chat-message ' + (who === 'self' ? 'chat-message-self' : 'chat-message-peer');
  el.textContent = text;
  log.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// =====================
// 自動マッチング（おまかせマッチング）
// =====================
// 固定IDの「待機スロット」を使ってマッチングする。
// スロットが空いていれば自分が待機ホストになり、誰かが待っていればゲストとして接続する。

// 自動マッチング開始
function startAutoMatch() {
  if (typeof Peer === 'undefined') {
    setOnlineMenuStatus('通信ライブラリの読み込みに失敗しています');
    return;
  }
  cleanupPeerOnly();
  onlinePhase = 'lobby';
  isOnlineHost = false;
  autoMatchAttempts = 0;
  
  // 待機UIへ切り替え（コード表示は行わない）
  document.getElementById('online-menu').style.display = 'none';
  document.getElementById('online-waiting').style.display = 'flex';
  document.getElementById('online-waiting-label').style.display = 'none';
  document.getElementById('room-code-display').style.display = 'none';
  setOnlineLobbyStatus('対戦相手を探しています…');
  
  autoMatchProbeSlots();
}

// スロットを順番に探索（新しい匿名Peerで開始）
function autoMatchProbeSlots() {
  autoMatchAttempts++;
  if (autoMatchAttempts > 3) {
    setOnlineLobbyStatus('現在マッチングできません。時間をおいて再度お試しください');
    return;
  }
  
  const probe = new Peer();
  autoMatchProbe = probe;
  
  probe.on('open', () => {
    probeNextSlot(probe, 1);
  });
  
  probe.on('error', (err) => {
    // peer-unavailable等のスロット単位のエラーはprobeSlot内で処理する
    console.log('マッチング探索エラー:', err.type);
  });
}

// スロットを1つずつ確認
function probeNextSlot(probe, slotIndex) {
  if (onlinePhase !== 'lobby') {
    try { probe.destroy(); } catch (e) {}
    return;
  }
  if (slotIndex > ONLINE_LOBBY_SLOTS) {
    // 全スロット使用中 → 少し待ってリトライ
    try { probe.destroy(); } catch (e) {}
    setOnlineLobbyStatus('対戦相手を探しています…');
    setTimeout(() => {
      if (onlinePhase === 'lobby') autoMatchProbeSlots();
    }, 1500);
    return;
  }
  
  const slotId = ONLINE_LOBBY_PREFIX + slotIndex;
  probeSlot(probe, slotId, (status, conn) => {
    if (onlinePhase !== 'lobby') {
      try { probe.destroy(); } catch (e) {}
      return;
    }
    if (status === 'waiting') {
      // 相手が待機中 → ゲストとして対戦開始（ホストからの 'start' を待つ）
      onlinePeer = probe;
      onlineConn = conn;
      autoMatchProbe = null;
      isOnlineHost = false;
      setupOnlineConnection();
      sendMyName();
      setOnlineLobbyStatus('対戦相手が見つかりました！');
    } else if (status === 'empty') {
      // 空きスロット → 自分が待機ホストになる
      try { probe.destroy(); } catch (e) {}
      autoMatchProbe = null;
      becomeLobbyHost(slotId);
    } else {
      // busy → 次のスロット
      probeNextSlot(probe, slotIndex + 1);
    }
  });
}

// スロットの状態を確認（'waiting' | 'busy' | 'empty'）
function probeSlot(probe, slotId, callback) {
  let done = false;
  let conn = null;
  
  const finish = (status) => {
    if (done) return;
    done = true;
    probe.off('error', onErr);
    clearTimeout(timer);
    if (status !== 'waiting' && conn) {
      try { conn.close(); } catch (e) {}
    }
    callback(status, conn);
  };
  
  const onErr = (err) => {
    if (err.type === 'peer-unavailable') finish('empty');
  };
  probe.on('error', onErr);
  
  const timer = setTimeout(() => finish('busy'), ONLINE_PROBE_TIMEOUT);
  
  conn = probe.connect(slotId, { reliable: true });
  
  conn.on('open', () => {
    conn.send({ type: 'matchRequest' });
  });
  conn.on('data', (d) => {
    if (d && d.type === 'matchReply') {
      finish(d.accept ? 'waiting' : 'busy');
    }
  });
  conn.on('close', () => finish('busy'));
  conn.on('error', () => finish('busy'));
}

// 空きスロットを自分のIDとして取得し、待機ホストになる
function becomeLobbyHost(slotId) {
  if (onlinePhase !== 'lobby') return;
  isOnlineHost = true;
  lobbySlotId = slotId;
  lobbyProbing = false;
  onlinePeer = new Peer(slotId);
  
  onlinePeer.on('open', () => {
    setOnlineLobbyStatus('対戦相手を待っています…');
    scheduleLobbyRescan();
  });
  
  onlinePeer.on('connection', (c) => {
    c.on('open', () => {
      c.on('data', function handleMatchRequest(d) {
        if (d && d.type === 'matchRequest') {
          if (!onlineConn && !lobbyProbing && onlinePhase === 'lobby') {
            // 待機中 → 受け入れて対戦開始
            c.send({ type: 'matchReply', accept: true });
            onlineConn = c;
            stopLobbyRescan();
            setupOnlineConnection();
            waitForNameThenStart();
          } else {
            // 既に対戦中など → 拒否
            c.send({ type: 'matchReply', accept: false });
          }
        }
      });
    });
  });
  
  onlinePeer.on('error', (err) => {
    console.log('ロビーホストエラー:', err.type);
    if (err.type === 'unavailable-id' && onlinePhase === 'lobby') {
      // スロットIDの取得競合に敗北 → そのスロットの持ち主に接続を試みる
      try { onlinePeer.destroy(); } catch (e) {}
      retrySlotAsGuest(slotId);
    }
  });
}

// スロットID取得に失敗した場合、その持ち主へゲストとして接続を試みる
function retrySlotAsGuest(slotId) {
  const retry = new Peer();
  autoMatchProbe = retry;
  
  retry.on('open', () => {
    probeSlot(retry, slotId, (status, conn) => {
      if (onlinePhase !== 'lobby') {
        try { retry.destroy(); } catch (e) {}
        return;
      }
      if (status === 'waiting') {
        onlinePeer = retry;
        onlineConn = conn;
        autoMatchProbe = null;
        isOnlineHost = false;
        setupOnlineConnection();
        sendMyName();
        setOnlineLobbyStatus('対戦相手が見つかりました！');
      } else if (status === 'empty') {
        // 相手が消えていた → 再度取得を試みる
        try { retry.destroy(); } catch (e) {}
        autoMatchProbe = null;
        becomeLobbyHost(slotId);
      } else {
        // busy → 最初から探索し直す
        try { retry.destroy(); } catch (e) {}
        autoMatchProbe = null;
        autoMatchProbeSlots();
      }
    });
  });
  
  retry.on('error', (err) => {
    console.log('再接続エラー:', err.type);
  });
}

// 待機中に他スロットを定期的に再探索（両者が待機側になったデッドロック対策）
function scheduleLobbyRescan() {
  if (lobbyRescanTimer) clearTimeout(lobbyRescanTimer);
  lobbyRescanTimer = setTimeout(runLobbyRescan, ONLINE_LOBBY_RESCAN_MIN + Math.random() * ONLINE_LOBBY_RESCAN_JITTER);
}

function runLobbyRescan() {
  lobbyRescanTimer = null;
  if (onlinePhase !== 'lobby' || !isOnlineHost || onlineConn || !onlinePeer) return;
  lobbyProbing = true;
  const probe = new Peer();
  autoMatchProbe = probe;
  
  probe.on('open', () => {
    rescanNextSlot(probe, 1);
  });
  
  probe.on('error', (err) => {
    console.log('再探索エラー:', err.type);
    if (autoMatchProbe !== probe) return;
    // peer-unavailable/webrtc はスロット単位のエラーなのでprobeSlot側に任せる
    if (err.type === 'peer-unavailable' || err.type === 'webrtc') return;
    // 探索自体が成立しない致命的エラー → 中断して次の周期へ
    try { probe.destroy(); } catch (e) {}
    autoMatchProbe = null;
    lobbyProbing = false;
    scheduleLobbyRescan();
  });
}

// 再探索でスロットを順番に確認（自分のスロットはスキップ）
function rescanNextSlot(probe, slotIndex) {
  if (onlinePhase !== 'lobby' || !isOnlineHost || onlineConn || probe.destroyed) {
    try { probe.destroy(); } catch (e) {}
    if (autoMatchProbe === probe) autoMatchProbe = null;
    lobbyProbing = false;
    return;
  }
  if (slotIndex > ONLINE_LOBBY_SLOTS) {
    // 待機中の相手が見つからなかった → 待機を継続して次の周期を予約
    try { probe.destroy(); } catch (e) {}
    if (autoMatchProbe === probe) autoMatchProbe = null;
    lobbyProbing = false;
    scheduleLobbyRescan();
    return;
  }
  
  const slotId = ONLINE_LOBBY_PREFIX + slotIndex;
  if (slotId === lobbySlotId) {
    rescanNextSlot(probe, slotIndex + 1);
    return;
  }
  
  probeSlot(probe, slotId, (status, conn) => {
    if (onlinePhase !== 'lobby' || !isOnlineHost || onlineConn || probe.destroyed) {
      try { probe.destroy(); } catch (e) {}
      if (autoMatchProbe === probe) autoMatchProbe = null;
      lobbyProbing = false;
      return;
    }
    if (status === 'waiting') {
      // 別の待機ホストを発見 → 自分のスロットを解放してゲストとして参加
      const oldHost = onlinePeer;
      onlinePeer = probe;
      onlineConn = conn;
      autoMatchProbe = null;
      isOnlineHost = false;
      lobbyProbing = false;
      lobbySlotId = null;
      try { oldHost.destroy(); } catch (e) {}
      setupOnlineConnection();
      sendMyName();
      setOnlineLobbyStatus('対戦相手が見つかりました！');
    } else {
      rescanNextSlot(probe, slotIndex + 1);
    }
  });
}

// 再探索のタイマーと探索用Peerを停止
function stopLobbyRescan() {
  if (lobbyRescanTimer) {
    clearTimeout(lobbyRescanTimer);
    lobbyRescanTimer = null;
  }
  if (autoMatchProbe && autoMatchProbe !== onlinePeer) {
    try { autoMatchProbe.destroy(); } catch (e) {}
    autoMatchProbe = null;
  }
  lobbyProbing = false;
}
