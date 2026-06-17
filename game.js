// game.js

/* ═══════════════════════════════
   CONFIGURAÇÕES GERAIS E ESTADOS
   ═══════════════════════════════ */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Define resolução física retrô do GBA
canvas.width = 240;
canvas.height = 160;

// Desativar suavização para manter o visual pixel art retrô
ctx.imageSmoothingEnabled = false;

// Estado da Máquina de Jogo
// INTRO, ROOM_1, ROOM_2, ROOM_3, ROOM_4, ROOM_5, ROOM_6, INVENTORY, DIALOGUE, INPUT, GAME_OVER, WIN, AISHITERU
let gameState = 'INTRO';
let previousGameState = 'ROOM_1';
let currentRoom = 1;

// Configuração do Jogador (Raicca)
const player = {
  tileX: 7,
  tileY: 7,
  x: 7 * 16,
  y: 7 * 16,
  targetX: 7 * 16,
  targetY: 7 * 16,
  isMoving: false,
  dir: 'down',
  colorHair: '#1a0a00', // Cabelo Preto escuro
  colorSkin: '#fce3db', // Pele clara
  colorDress: '#d81b60', // Vestido Rosa Escuro
  animFrame: 0,
  hp: 12,        // 6 corações (cada 2 HP = 1 coração)
  maxHp: 12,
  invincibleFrames: 0,
  isAttacking: false,
  attackTimer: 0,
  attackDir: 'down',
  flashRed: 0
};

// Configuração de Vitória (vilã/sequestradora - negra de cabelos cacheados)
const vitoria = {
  x: 7 * 16,
  y: 2 * 16,
  hp: 10, // 5 golpes de espada (2 HP por golpe)
  maxHp: 10,
  colorHair: '#1a0800',  // Cabelo preto escuro (cacheado)
  colorSkin: '#5c3317',  // Pele negra
  colorDress: '#6a0dad', // Vestido roxo de vilã
  dir: 'down',
  floatTimer: 0,
  shootCooldown: 0,
  flashRed: 0,
  active: false
};

// Configuração do Eduardo (NPC final preso)
const eduardo = {
  tileX: 7,
  tileY: 1,
  x: 7 * 16,
  y: 1 * 16,
  colorHair: '#2c1a0e',
  colorSkin: '#c68642',
  colorClothes: '#ffffff',
  inCage: true
};

// Inventário e Itens
let inventory = []; // Max 8 itens
let equippedItemIndex = -1; // -1 significa nenhum item equipado
let inventorySelectedIndex = 0; // Índice de seleção na tela do inventário

// Flags de progresso nas salas
let room1ChestOpened = false;
let room2SwitchesPressed = [false, false, false]; // [Esquerdo, Meio, Direito]
let room2OrderPressed = []; // Ordem que o jogador pisou
const room2CorrectOrder = [0, 2, 1]; // Esquerdo, Direito, Meio
let room2GateOpen = false;

let room3NpcHelped = false; // Cachorrinho deu a poção
let room4KeyDropped = false;
let room4CellOpen = false;
let room4PrisonerTalked = false;
let room4CodeEntered = false;
// Puzzle de Cores da Sala 5 - Estilo Undertale Battle
let room5Solved = false;
const room5TargetSequence = ['red', 'green', 'blue', 'yellow'];
const room5ColorNames = { red: 'VERMELHO', green: 'VERDE', blue: 'AZUL', yellow: 'AMARELO' };
const room5ColorHex = { red: '#e53935', green: '#43a047', blue: '#1e88e5', yellow: '#fdd835' };

// Estado da batalha Undertale
let colorBattle = {
  active: false,
  phase: 0,          // índice na sequência (0-3)
  waveTimer: 0,
  waveMax: 180,       // frames por onda
  introTimer: 120,    // frames de intro antes de começar
  showIntro: false,
  collected: 0,       // quantas cores coletadas
  // Soul (coraçãozinho do jogador)
  soul: { x: 120, y: 110, size: 5 },
  soulSpeed: 1.8,
  // Projéteis da onda atual
  bullets: [],
  spawnTimer: 0,
  phase0Done: false
};

// Partículas e Efeitos Visuais
let particles = [];
let projectiles = [];
let enemies = [];
let shakeScreenTime = 0;

// Controles de direção pressionados (Teclado / Celular virtual)
const keysHeld = {
  up: false,
  down: false,
  left: false,
  right: false
};

// Caixa de diálogo DOM
const dlgBox = document.getElementById('gba-dialogue-box');
const dlgText = document.getElementById('gba-dialogue-text');
const dlgInputArea = document.getElementById('gba-input-area');
const dlgTextInput = document.getElementById('gba-text-input');
const dlgBtnSubmit = document.getElementById('gba-btn-submit');
const dlgArrow = document.getElementById('gba-dialogue-arrow');

// Diálogos enfileirados
let dialogueQueue = [];
let dialogueCallback = null;
let textToType = "";
let textIndex = 0;
let isTyping = false;
let dialogueAutoCloseTimeout = null;

// Chuva de corações no fim
let aishiteruRainInterval = null;
let finalAishiteruCount = 0;

/* ═══════════════════════════════
   MAPAS DO JOGO (15x10 tiles, 16px)
   0: Chão livre
   1: Parede / Obstáculo sólido
   2: Arbusto cortável (Room 1)
   3: Baú Fechado / 3.1: Baú Aberto
   4: Placa de Leitura
   5: Interruptor de Pressão (Room 2)
   6: Espinhos Retráteis (Room 3)
   7: Porta Trancada / Grade
   8: Piso Colorido (Vermelho, Verde, Azul, Amarelo) (Room 5)
   ═══════════════════════════════ */
const MAP_WIDTH = 15;
const MAP_HEIGHT = 10;
const TILE_SIZE = 16;

const maps = {
  1: [
    [1, 1, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1], // Porta trancada no topo (7)
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
    [1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 2, 2, 2, 2, 2, 0, 0, 0, 0, 1], // Linha de arbustos (2) bloqueando o caminho
    [1, 0, 3, 0, 0, 2, 0, 0, 0, 2, 0, 0, 4, 0, 1], // Baú (3) à esquerda, Placa (4) à direita
    [1, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  2: [
    [1, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1], // Portão do castelo (7)
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 1], // Três botões de pressão (5)
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Placa com a dica
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  3: [
    [1, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1], // Saída ao norte (7)
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 1, 6, 6, 6, 6, 6, 1, 0, 0, 0, 1], // Linha de espinhos (6)
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 1, 6, 6, 6, 6, 6, 1, 0, 0, 0, 1], // Outra linha de espinhos (6)
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // NPC fica em (2, 4)
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  4: [
    [1, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1], // Porta de saída trancada por senha
    [1, 1, 7, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1], // Cela do prisioneiro (trancada por grade 7) em (2,1)
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Placa / Teclado da senha ao lado da porta
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  5: [
    [1, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1], // Saída
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Placa dica da batalha
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  6: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], // Eduardo preso em (7, 1) na gaiola
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ]
};

// Cores dos Pisos da Sala 5
const room5Pisos = [
  ['red',    'green', 'blue',   'yellow', 'red',    'green', 'blue',   'yellow', 'red'],
  ['green',  'blue',  'yellow', 'red',    'green',  'blue',  'yellow', 'red',    'green'],
  ['blue',   'yellow','red',    'green',  'blue',   'yellow','red',    'green',  'blue']
];

/* ═══════════════════════════════
   INICIALIZAÇÃO DO JOGO
   ═══════════════════════════════ */
function initGame() {
  loadRoom(1);
  gameState = 'INTRO';
}

function loadRoom(roomNum) {
  currentRoom = roomNum;
  player.isMoving = false;
  projectiles = [];
  particles = [];
  enemies = [];

  // Limpa direções seguradas ao mudar de sala
  keysHeld.up = false;
  keysHeld.down = false;
  keysHeld.left = false;
  keysHeld.right = false;

  // Posicionar jogador dependendo da sala
  if (roomNum === 1) {
    player.tileX = 7;
    player.tileY = 7;
  } else if (roomNum === 2) {
    player.tileX = 7;
    player.tileY = 8;
  } else if (roomNum === 3) {
    player.tileX = 7;
    player.tileY = 8;
  } else if (roomNum === 4) {
    player.tileX = 7;
    player.tileY = 8;
  } else if (roomNum === 5) {
    player.tileX = 7;
    player.tileY = 8;
  } else if (roomNum === 6) {
    player.tileX = 7;
    player.tileY = 8;
    vitoria.hp = 10;
    vitoria.active = false;
    vitoria.x = 7 * 16;
    vitoria.y = 3 * 16;
    eduardo.inCage = true;
  }

  player.x = player.tileX * TILE_SIZE;
  player.y = player.tileY * TILE_SIZE;
  player.targetX = player.x;
  player.targetY = player.y;

  // Iniciar inimigos específicos por sala
  if (roomNum === 2) {
    enemies = [
      { x: 3 * 16, y: 3 * 16, tileX: 3, tileY: 3, hp: 4, type: 'guard', dir: 'right', isAggro: false, color: '#3f51b5', speed: 0.5 },
      { x: 11 * 16, y: 3 * 16, tileX: 11, tileY: 3, hp: 4, type: 'guard', dir: 'left', isAggro: false, color: '#3f51b5', speed: 0.5 }
    ];
  } else if (roomNum === 4) {
    enemies = [
      { x: 3 * 16, y: 4 * 16, tileX: 3, tileY: 4, hp: 6, type: 'jailer', dir: 'down', isAggro: false, color: '#607d8b', speed: 0.6 },
      { x: 11 * 16, y: 4 * 16, tileX: 11, tileY: 4, hp: 6, type: 'jailer', dir: 'down', isAggro: false, color: '#607d8b', speed: 0.6 }
    ];
  }
}

/* ═══════════════════════════════
   SISTEMA DE VERIFICAÇÃO DE COLISÕES
   ═══════════════════════════════ */
function getTileAt(room, col, row) {
  if (col < 0 || col >= MAP_WIDTH || row < 0 || row >= MAP_HEIGHT) return 1;
  return maps[room][row][col];
}

function isWalkable(col, row) {
  const tile = getTileAt(currentRoom, col, row);
  if (tile === 1 || tile === 2 || tile === 3) return false; // Parede, Arbusto, Baú Fechado
  
  // Porta/grade trancada
  if (tile === 7) {
    if (currentRoom === 1 && !room1ChestOpened) return false;
    if (currentRoom === 2 && !room2GateOpen) return false;
    if (currentRoom === 3) return true; // Porta da sala 3 está aberta
    if (currentRoom === 4 && col === 2 && row === 1 && !room4CellOpen) return false; // Grade cela
    if (currentRoom === 4 && col === 7 && row === 0 && !room4CodeEntered) return false; // Porta com senha
    if (currentRoom === 5 && !room5Solved) return false;
  }
  
  // Eduardo na gaiola bloqueia
  if (currentRoom === 6 && col === eduardo.tileX && row === eduardo.tileY && eduardo.inCage) {
    return false;
  }
  return true;
}

/* ═══════════════════════════════
   CONTROLES DO JOGADOR
   ═══════════════════════════════ */
function movePlayer(dx, dy, dirName) {
  if (gameState !== `ROOM_${currentRoom}`) return;
  if (player.isMoving || player.isAttacking) return;

  player.dir = dirName;

  const nextX = player.tileX + dx;
  const nextY = player.tileY + dy;

  // Triggers de saída no topo (Portas)
  if (nextY < 0 && nextX === 7) {
    if (currentRoom < 6) {
      loadRoom(currentRoom + 1);
      showDialogue([`Você avançou para a Sala ${currentRoom}.`]);
    }
    return;
  }
  if (nextY < 0 && currentRoom === 1 && nextX === 8 && room1ChestOpened) {
    loadRoom(2);
    showDialogue(["Você passou para o Portão do Castelo."]);
    return;
  }

  if (isWalkable(nextX, nextY)) {
    player.tileX = nextX;
    player.tileY = nextY;
    player.targetX = nextX * TILE_SIZE;
    player.targetY = nextY * TILE_SIZE;
    player.isMoving = true;

    // Lógica ao pisar em pisos
    checkTileTriggers(nextX, nextY);
  }
}

function checkTileTriggers(col, row) {
  const tile = getTileAt(currentRoom, col, row);

  // Espinhos ativos dão dano
  if (tile === 6) {
    const time = Math.floor(Date.now() / 1000) % 2;
    if (time === 0) {
      damagePlayer(2); // 1 Coração
    }
  }

  // Interruptores de Pressão da Sala 2
  if (currentRoom === 2 && tile === 5) {
    let swIndex = -1;
    if (col === 2) swIndex = 0; // Esquerdo
    if (col === 6) swIndex = 1; // Meio
    if (col === 10) swIndex = 2; // Direito

    if (swIndex !== -1 && !room2SwitchesPressed[swIndex]) {
      room2SwitchesPressed[swIndex] = true;
      room2OrderPressed.push(swIndex);
      spawnParticle(col * 16 + 8, row * 16 + 8, '#ffeb3b', 8);
      shakeScreen(5);

      // Checa sequência
      if (room2OrderPressed.length === 3) {
        let correct = true;
        for (let i = 0; i < 3; i++) {
          if (room2OrderPressed[i] !== room2CorrectOrder[i]) correct = false;
        }

        if (correct) {
          room2GateOpen = true;
          maps[2][0][7] = 0; // Remove o portão trancado
          showDialogue(["Um som pesado de engrenagens ecoa!", "O Portão do Castelo foi destrancado!"]);
        } else {
          showDialogue(["Incorreto! O mecanismo reiniciou e emitiu uma descarga."]);
          damagePlayer(2);
          room2SwitchesPressed = [false, false, false];
          room2OrderPressed = [];
        }
      }
    }
  }

  // Sala 5: ativar batalha de cores ao entrar no trigger central
  if (currentRoom === 5 && !room5Solved && !colorBattle.active) {
    if (col >= 3 && col <= 11 && row >= 3 && row <= 5) {
      startColorBattle();
    }
  }
}

// Executar Ataque com a Espada de Bronze
function triggerSwordAttack() {
  if (player.isAttacking) return;

  player.isAttacking = true;
  player.attackTimer = 15; // Duração do ataque em frames
  player.attackDir = player.dir;

  // Centro do jogador
  const px = player.x + 8;
  const py = player.y + 8;

  // Centro da área de ataque com a espada (12 pixels à frente do jogador)
  let ax = px;
  let ay = py;
  if (player.dir === 'up') ay -= 12;
  else if (player.dir === 'down') ay += 12;
  else if (player.dir === 'left') ax -= 12;
  else if (player.dir === 'right') ax += 12;

  // 1. Cortar Arbustos (Tile 2 na Sala 1)
  const cutCol = Math.floor(ax / 16);
  const cutRow = Math.floor(ay / 16);
  if (currentRoom === 1 && getTileAt(1, cutCol, cutRow) === 2) {
    maps[1][cutRow][cutCol] = 0; // Remove o arbusto
    spawnParticle(cutCol * 16 + 8, cutRow * 16 + 8, '#4caf50', 12); // Partículas de folhas
    shakeScreen(5);
  }

  // 2. Acertar Inimigos (Hitbox baseada em distância de pixels)
  // Aceita acertar se o inimigo estiver na área do ataque OU sobreposto ao jogador
  enemies.forEach(enemy => {
    const ex = enemy.x + 8;
    const ey = enemy.y + 8;
    
    const distToAttack = Math.hypot(ex - ax, ey - ay);
    const distToPlayer = Math.hypot(ex - px, ey - py);

    if (distToAttack < 18 || distToPlayer < 14) {
      enemy.hp -= 2;
      enemy.flashRed = 10;
      // Empurrão retrô na direção do ataque
      if (player.dir === 'up') enemy.y -= 8;
      if (player.dir === 'down') enemy.y += 8;
      if (player.dir === 'left') enemy.x -= 8;
      if (player.dir === 'right') enemy.x += 8;
      
      spawnParticle(ex, ey, '#f44336', 8);
    }
  });

  // 3. Acertar Vitória Chefe (Sala 6)
  if (currentRoom === 6 && vitoria.active) {
    const vx = vitoria.x + 8;
    const vy = vitoria.y + 8;
    
    const distToAttack = Math.hypot(vx - ax, vy - ay);
    const distToPlayer = Math.hypot(vx - px, vy - py);

    if (distToAttack < 20 || distToPlayer < 16) {
      vitoria.hp -= 2;
      vitoria.flashRed = 15;
      shakeScreen(10);
      spawnParticle(vx, vy, '#e040fb', 15);
      
      if (vitoria.hp <= 0) {
        defeatVitoria();
      }
    }
  }
}

// Botão B serve para cancelar / fechar caixas de diálogo
function handleButtonB() {
  if (gameState === 'DIALOGUE') {
    if (isTyping) {
      isTyping = false;
      textIndex = textToType.length;
      dlgText.textContent = textToType;
      dlgArrow.classList.remove('hidden');
    } else {
      nextDialogue();
    }
  }
}

// Interagir / Usar Item / Atacar
function handleButtonA() {
  if (gameState === 'INTRO') {
    gameState = 'ROOM_1';
    showDialogue([
      "Onde estou? Tudo está tão escuro...",
      "Vitória me trancou aqui por ciúmes de mim com o Dudu!",
      "Preciso escapar deste castelo e salvar o Eduardo!",
      "Procure no baú à esquerda por algo útil. Use o analógico virtual ou teclado para andar e [A] para interagir."
    ]);
    return;
  }

  if (gameState === 'DIALOGUE') {
    if (isTyping) {
      isTyping = false;
      textIndex = textToType.length;
      dlgText.textContent = textToType;
      dlgArrow.classList.remove('hidden');
    } else {
      nextDialogue();
    }
    return;
  }

  if (gameState === 'INPUT') {
    dlgBtnSubmit.click();
    return;
  }

  if (gameState === 'GAME_OVER') {
    restartGame();
    return;
  }

  if (gameState === 'INVENTORY') {
    // Equipar item selecionado
    if (inventory.length > 0) {
      equippedItemIndex = inventorySelectedIndex;
      const item = inventory[equippedItemIndex];
      showDialogue([`Você equipou: ${item.name}!`, item.desc]);
      gameState = `ROOM_${currentRoom}`;
    }
    return;
  }

  // Interação no Mundo à frente
  let fx = player.tileX;
  let fy = player.tileY;
  if (player.dir === 'up') fy--;
  else if (player.dir === 'down') fy++;
  else if (player.dir === 'left') fx--;
  else if (player.dir === 'right') fx++;

  const tile = getTileAt(currentRoom, fx, fy);
  let hasInteracted = false;

  // 1. Abrir Baú (Sala 1)
  if (currentRoom === 1 && tile === 3 && !room1ChestOpened) {
    room1ChestOpened = true;
    maps[1][fy][fx] = 0; // Remove baú
    inventory.push({ name: 'Espada de Bronze', desc: 'Útil para cortar arbustos de espinhos e golpear guardas. [Botão A para bater]', type: 'weapon' });
    inventory.push({ name: 'Maçã', desc: 'Cura totalmente seu HP. Pode ser usada equipando no Inventário.', type: 'heal' });
    showDialogue([
      "Você abriu o baú antigo!",
      "Você obteve a ESPADA DE BRONZE e uma MAÇÃ!",
      "Abra o Inventário pressionando [SELECT], selecione a espada ou maçã com o direcional e aperte [A] para equipar/usar."
    ]);
    hasInteracted = true;
  }

  // 2. Ler Placa (Sala 1)
  else if (currentRoom === 1 && tile === 4) {
    showDialogue([
      "Placa de Aviso:",
      "\"A saída ao norte está lacrada. Apenas quem empunha a lâmina de bronze pode rasgar a folhagem tóxica.\""
    ]);
    hasInteracted = true;
  }

  // 3. Ler Dica (Sala 2)
  else if (currentRoom === 2 && tile === 4) {
    showDialogue([
      "Inscrição na Parede:",
      "\"Para abrir os portões do ciúme eterno, ative os pilares na ordem correta...\"",
      "\"O da esquerda chora primeiro, o da direita sorri depois, e o do centro une a possessão.\"",
      "(Dica: Pise nos botões na ordem: Esquerda, Direita e depois Centro)"
    ]);
    hasInteracted = true;
  }

  // 4. Interagir com Cachorrinho NPC (Sala 3)
  else if (currentRoom === 3 && fx === 2 && fy === 4 && !room3NpcHelped) {
    room3NpcHelped = true;
    inventory.push({ name: 'Poção de Vida', desc: 'Cura totalmente seu HP. Pode ser usada equipando no Inventário.', type: 'heal' });
    showDialogue([
      "Um cachorrinho caramelo fofinho está encolhido aqui!",
      "Ele late alegremente e te dá uma Poção de Vida!",
      "Você obteve POÇÃO DE VIDA!"
    ]);
    hasInteracted = true;
  }

  // 5. Placa / Teclado de Senha (Sala 4)
  else if (currentRoom === 4 && tile === 4) {
    if (room4CodeEntered) {
      showDialogue(["O painel já está destravado!"]);
    } else if (!room4PrisonerTalked) {
      showDialogue(["O painel exige uma senha de 4 dígitos para destravar o portão norte.", "Você não faz ideia de qual seja."]);
    } else {
      showDialogue(["Painel Eletrônico de Senha:", "Insira a senha fornecida pelo prisioneiro."], () => {
        showInput("Senha...", (val) => {
          if (val === '1312') {
            room4CodeEntered = true;
            maps[4][0][7] = 0; // Abre porta norte
            showDialogue(["BEEP! Código correto!", "A porta do corredor norte destravou!"]);
          } else {
            showDialogue(["Acesso Negado! Código incorreto."]);
            damagePlayer(1);
          }
        });
      });
    }
    hasInteracted = true;
  }

  // 6. Falar com Prisioneiro na cela (Sala 4) - Exige Chave na Mão
  else if (currentRoom === 4 && fx === 2 && fy === 1) {
    const equipped = inventory[equippedItemIndex];
    const keyEquipped = equipped && equipped.name === 'Chave Prateada';
    
    if (!keyEquipped) {
      showDialogue([
        "Prisioneiro: \"Por favor, me salve! Os guardas da Vitória me trancaram aqui!\"",
        "\"O guarda chefe tem a Chave Prateada. Equipe-a na sua mão ([SELECT]) para abrir a minha cela!\""
      ]);
    } else {
      // Abre a cela
      room4CellOpen = true;
      room4PrisonerTalked = true;
      // Remover chave equipada do inventário
      inventory.splice(equippedItemIndex, 1);
      equippedItemIndex = -1;
      
      showDialogue([
        "Você usou a Chave Prateada que estava na sua mão para abrir a cela!",
        "Prisioneiro: \"Muito obrigado! Você é incrível!\"",
        "\"Como recompensa, aqui está a senha do portão eletrônico ao norte: 1312!\"",
        "\"Vá rápido! A Vitória está na sala do trono logo à frente e o ciúme dela é perigoso!\""
      ]);
    }
    hasInteracted = true;
  }

  // 7. Ler Placa (Sala 5)
  else if (currentRoom === 5 && tile === 4) {
    showDialogue([
      "Inscrição Mágica:",
      "\"Para abrir a porta do Trono de Vitória, prove seu valor!\"",
      "\"Uma batalha mágica das cores aguarda. Use o direcional para mover seu coração.\"",
      "\"Toque a cor CORRETA na ordem: VERMELHO → VERDE → AZUL → AMARELO.\"",
      "\"As esferas brilhantes são as corretas. Evite as outras!\""
    ]);
    hasInteracted = true;
  }

  // 8. Conversar com Vitória na Sala do Trono (Sala 6)
  else if (currentRoom === 6 && fx === Math.floor(vitoria.x/16) && fy === Math.floor(vitoria.y/16)) {
    if (!vitoria.active) {
      vitoria.active = true;
      showDialogue([
        "Vitória: \"Então você finalmente chegou, Raicca...\"",
        "\"Você realmente achou que poderia vir tirar o Eduardo de mim?\"",
        "\"Ele é MEU! Eu o sequestrei para garantir que ele nunca olhe para mais ninguém!\"",
        "\"Cabelos cacheados esvoaçando, olhos de ciúme... Eu não vou perder! MORRA!\""
      ]);
      hasInteracted = true;
    }
  }

  // 9. Interações com Portas Trancadas / Grades (Tile 7)
  else if (tile === 7) {
    // Porta da Sala 1
    if (currentRoom === 1) {
      if (!room1ChestOpened) {
        showDialogue([
          "A porta norte está selada com cipós espinhosos tóxicos.",
          "Procure algo no baú antigo para ajudar a cortá-los!"
        ]);
      } else {
        showDialogue([
          "Você já possui a Espada de Bronze!",
          "Equipe-a no Inventário [SELECT] e aperte [A] de frente para os arbustos para abrir caminho."
        ]);
      }
    }
    // Porta da Sala 2
    else if (currentRoom === 2) {
      if (!room2GateOpen) {
        showDialogue([
          "O portão de ferro do castelo está trancado.",
          "Existem 3 interruptores de pressão no chão de pedra.",
          "Pise neles na ordem correta para abrir o mecanismo!"
        ]);
      }
    }
    // Porta da Sala 4 (Saída da Masmorra ao norte)
    else if (currentRoom === 4 && fx === 7 && fy === 0) {
      if (room4CodeEntered) {
        showDialogue(["O painel já está destravado! A porta norte está aberta."]);
      } else if (!room4PrisonerTalked) {
        showDialogue([
          "Este portão de segurança de ferro está travado eletronicamente por senha.",
          "Você precisa de uma combinação eletrônica de 4 dígitos para abri-lo."
        ]);
      } else {
        showDialogue(["Painel Eletrônico de Senha da Porta:", "Insira a senha de 4 dígitos fornecida pelo prisioneiro."], () => {
          showInput("Senha...", (val) => {
            if (val === '1312') {
              room4CodeEntered = true;
              maps[4][0][7] = 0; // Abre porta norte
              showDialogue(["BEEP! Código correto!", "A porta do corredor norte destravou!"]);
            } else {
              showDialogue(["Código incorreto! Acesso Negado."]);
              damagePlayer(1);
            }
          });
        });
      }
    }
    // Porta da Sala 5
    else if (currentRoom === 5 && fx === 7 && fy === 0) {
      showDialogue([
        "A porta da Sala do Trono de Vitória está selada por uma barreira mágica de cores.",
        "Você precisa pisar nas cores corretas do piso na ordem certa!"
      ]);
    }
    hasInteracted = true;
  }

  // Se o item equipado for uma Poção de Vida, e NÃO interagiu com nada, cura
  if (!hasInteracted && equippedItemIndex !== -1 && inventory[equippedItemIndex].type === 'heal') {
    const item = inventory[equippedItemIndex];
    player.hp = player.maxHp;
    inventory.splice(equippedItemIndex, 1);
    equippedItemIndex = -1;
    if (item.name === 'Maçã') {
      showDialogue(["Você comeu a Maçã!", "Seu HP foi totalmente restaurado!"]);
    } else {
      showDialogue(["Você bebeu a Poção de Vida!", "Seu HP foi totalmente restaurado!"]);
    }
    return;
  }

  // Se a Espada de Bronze estiver equipada, bater/atacar
  const equipped = inventory[equippedItemIndex];
  if (equipped && equipped.name === 'Espada de Bronze') {
    triggerSwordAttack();
  }
}

/* ═══════════════════════════════
   SISTEMA DE PAUSA / INVENTÁRIO
   ═══════════════════════════════ */
function toggleInventory() {
  if (gameState === 'INTRO' || gameState === 'GAME_OVER' || gameState === 'WIN' || gameState === 'AISHITERU' || gameState === 'DIALOGUE') return;

  if (gameState === 'INVENTORY') {
    gameState = `ROOM_${currentRoom}`;
  } else {
    previousGameState = gameState;
    gameState = 'INVENTORY';
    inventorySelectedIndex = 0;
  }
}

/* ═══════════════════════════════
   LÓGICA DOS INIMIGOS E DANOS
   ═══════════════════════════════ */
// Verifica se o inimigo pode se mover para determinada coordenada de pixels (colisão com paredes)
function canEnemyMoveTo(ex, ey) {
  // Hitbox de 12x12 pixels centralizada no inimigo
  const left = ex + 2;
  const right = ex + 14;
  const top = ey + 4;
  const bottom = ey + 15;

  const colL = Math.floor(left / 16);
  const colR = Math.floor(right / 16);
  const rowT = Math.floor(top / 16);
  const rowB = Math.floor(bottom / 16);

  // Se qualquer canto do inimigo tentar entrar em um bloco não caminhável
  if (!isWalkable(colL, rowT) || !isWalkable(colR, rowT) || 
      !isWalkable(colL, rowB) || !isWalkable(colR, rowB)) {
    return false;
  }
  return true;
}

function updateEnemies() {
  if (gameState !== `ROOM_${currentRoom}`) return;

  enemies.forEach((enemy, index) => {
    // IA de aproximação / Aggro (4 tiles de distância)
    const distCol = Math.abs(enemy.tileX - player.tileX);
    const distRow = Math.abs(enemy.tileY - player.tileY);

    if (distCol <= 4 && distRow <= 4) {
      enemy.isAggro = true;
    }

    let nextX = enemy.x;
    let nextY = enemy.y;

    if (enemy.isAggro) {
      // Segue o jogador lentamente
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;

      if (Math.abs(dx) > Math.abs(dy)) {
        nextX += Math.sign(dx) * enemy.speed;
        enemy.dir = dx > 0 ? 'right' : 'left';
        
        // Se houver parede horizontal, tenta deslizar verticalmente
        if (!canEnemyMoveTo(nextX, enemy.y)) {
          nextX = enemy.x;
          nextY += Math.sign(dy) * enemy.speed;
        }
      } else {
        nextY += Math.sign(dy) * enemy.speed;
        enemy.dir = dy > 0 ? 'down' : 'up';

        // Se houver parede vertical, tenta deslizar horizontalmente
        if (!canEnemyMoveTo(enemy.x, nextY)) {
          nextY = enemy.y;
          nextX += Math.sign(dx) * enemy.speed;
        }
      }
    } else {
      // Patrulha básica
      if (Math.random() < 0.02) {
        const dirs = ['up', 'down', 'left', 'right'];
        enemy.dir = dirs[Math.floor(Math.random() * dirs.length)];
      }

      if (enemy.dir === 'up') nextY -= enemy.speed;
      if (enemy.dir === 'down') nextY += enemy.speed;
      if (enemy.dir === 'left') nextX -= enemy.speed;
      if (enemy.dir === 'right') nextX += enemy.speed;

      // Se bater na parede na patrulha, escolhe outra direção
      if (!canEnemyMoveTo(nextX, nextY)) {
        nextX = enemy.x;
        nextY = enemy.y;
        const dirs = ['up', 'down', 'left', 'right'];
        enemy.dir = dirs[Math.floor(Math.random() * dirs.length)];
      }
    }

    // Aplica o movimento se for válido
    if (canEnemyMoveTo(nextX, nextY)) {
      enemy.x = nextX;
      enemy.y = nextY;
    }

    // Atualiza tileX/tileY do inimigo para IA
    enemy.tileX = Math.floor((enemy.x + 8) / 16);
    enemy.tileY = Math.floor((enemy.y + 8) / 16);

    // Impedir inimigos de sair das bordas externas de segurança
    if (enemy.x < 16) enemy.x = 16;
    if (enemy.x > 224) enemy.x = 224;
    if (enemy.y < 16) enemy.y = 16;
    if (enemy.y > 128) enemy.y = 128;

    // Colisão com o jogador
    const px = player.x + 8;
    const py = player.y + 8;
    const ex = enemy.x + 8;
    const ey = enemy.y + 8;
    const dist = Math.hypot(px - ex, py - ey);

    if (dist < 12) {
      damagePlayer(1); // Causa meio coração de dano
    }

    // Se o inimigo morrer
    if (enemy.hp <= 0) {
      // Na sala 4, o primeiro guarda dropa a chave prateada
      if (currentRoom === 4 && !room4KeyDropped) {
        room4KeyDropped = true;
        inventory.push({ name: 'Chave Prateada', desc: 'Uma chave de metal brilhante. Serve para abrir celas.', type: 'key' });
        showDialogue(["Você derrotou o guarda carcereiro!", "Você obteve a CHAVE PRATEADA!"]);
      }
      spawnParticle(enemy.x + 8, enemy.y + 8, '#ff9800', 10);
      enemies.splice(index, 1);
    }

    if (enemy.flashRed > 0) enemy.flashRed--;
  });
}

function damagePlayer(amount) {
  if (player.invincibleFrames > 0) return;

  player.hp -= amount;
  player.invincibleFrames = 60; // 1 segundo de invencibilidade
  player.flashRed = 20;
  shakeScreen(15);

  if (player.hp <= 0) {
    player.hp = 0;
    triggerGameOver();
  }
}

function shakeScreen(duration) {
  shakeScreenTime = duration;
}

function triggerGameOver() {
  gameState = 'GAME_OVER';
  hideDialogue(); // Garante que nenhum diálogo fique na tela de Game Over
  // Para batalha de cores se estava ativa
  colorBattle.active = false;
  colorBattle.bullets = [];
  // Auto-reinicia após 2.5 segundos
  setTimeout(() => {
    restartGame();
  }, 2500);
}

function restartGame() {
  player.hp = player.maxHp;
  inventory = [];
  equippedItemIndex = -1;
  room1ChestOpened = false;
  room2SwitchesPressed = [false, false, false];
  room2OrderPressed = [];
  room2GateOpen = false;
  room3NpcHelped = false;
  room4KeyDropped = false;
  room4CellOpen = false;
  room4PrisonerTalked = false;
  room4CodeEntered = false;
  room5Solved = false;
  colorBattle.active = false;
  colorBattle.bullets = [];
  colorBattle.phase = 0;
  colorBattle.collected = 0;
  colorBattle.introTimer = 120;
  colorBattle.showIntro = false;
  colorBattle.waveTimer = 0;
  vitoria.hp = vitoria.maxHp;
  vitoria.active = false;
  eduardo.inCage = true;
  
  maps[1][5][2] = 3; // Reseta baú
  maps[2][0][7] = 7; // Reseta portão
  maps[4][0][7] = 7; // Reseta portão eletrônico
  maps[4][1][2] = 7; // Reseta cela
  maps[5][0][7] = 7; // Reseta saída
  
  stopAishiteruRain();
  loadRoom(1);
  gameState = 'INTRO';
}

/* ═══════════════════════════════
   PUZZLE DE CORES - ESTILO UNDERTALE
   ═══════════════════════════════ */
function startColorBattle() {
  if (colorBattle.active || room5Solved) return;
  colorBattle.active = true;
  colorBattle.phase = 0;
  colorBattle.collected = 0;
  colorBattle.waveTimer = 0;
  colorBattle.introTimer = 140;
  colorBattle.showIntro = true;
  colorBattle.bullets = [];
  colorBattle.spawnTimer = 0;
  colorBattle.soul.x = 120;
  colorBattle.soul.y = 108;

  showDialogue([
    "Uma presença mágica envolve a sala...",
    "\"Prove que merece passar! Esquive das cores na ordem CORRETA!\"",
    "Ordem: VERMELHO → VERDE → AZUL → AMARELO",
    "Toque as cores corretas. Evite as erradas!"
  ]);
}

function spawnBulletsForPhase(phase) {
  const targetColor = room5TargetSequence[phase];
  const allColors = ['red', 'green', 'blue', 'yellow'];
  const w = canvas.width;
  const h = canvas.height;

  // Padrão de projéteis: combinação das 4 cores, mas a CORRETA vem mais lenta (para poder tocar)
  // Projéteis ERRADOS são lentos e fáceis de desviar
  // Projéteis CORRETOS são ainda mais lentos e brilham
  const patterns = [
    // Fase 0 (VERMELHO): projéteis horizontais da esquerda
    () => {
      // Menos projéteis horizontais (apenas 3) com espaçamento maior
      for (let i = 0; i < 3; i++) {
        const y = 50 + i * 30;
        // projétil correto no meio, os outros são errados
        if (i === 1) {
          colorBattle.bullets.push({ x: -8, y, dx: 0.7, dy: 0, color: targetColor, size: 5, correct: true, glow: true });
        } else {
          colorBattle.bullets.push({ x: -8, y, dx: 1.2, dy: 0, color: allColors[i === 0 ? 1 : 2], size: 4, correct: false });
        }
      }
      // Apenas 1 projétil subindo lentamente
      colorBattle.bullets.push({ x: w / 2, y: h + 8, dx: 0, dy: -1.2, color: 'blue', size: 4, correct: false });
    },
    // Fase 1 (VERDE): projéteis diagonais
    () => {
      // Apenas 2 errados vindo da esquerda
      colorBattle.bullets.push({ x: -8, y: 40, dx: 1.2, dy: 0.2, color: 'red', size: 4, correct: false });
      colorBattle.bullets.push({ x: -8, y: 110, dx: 1.2, dy: -0.2, color: 'blue', size: 4, correct: false });
      
      // Correto: vem da direita devagar
      colorBattle.bullets.push({ x: w + 8, y: 80, dx: -0.7, dy: 0, color: targetColor, size: 5, correct: true, glow: true });
      
      // Apenas 1 descendo do topo
      colorBattle.bullets.push({ x: w / 2 - 30, y: -8, dx: 0, dy: 1.2, color: 'yellow', size: 4, correct: false });
    },
    // Fase 2 (AZUL): ondas circulares
    () => {
      const cx = w / 2, cy = 80;
      // Reduzido de 8 para 5 projéteis no círculo, velocidade bem mais lenta
      for (let a = 0; a < 5; a++) {
        const angle = (a / 5) * Math.PI * 2;
        const c = (a === 2) ? targetColor : allColors[a % 4];
        const correct = a === 2;
        const speed = correct ? 0.5 : 1.1;
        colorBattle.bullets.push({ x: cx, y: cy, dx: Math.cos(angle)*speed, dy: Math.sin(angle)*speed, color: c, size: correct ? 5 : 4, correct, glow: correct });
      }
    },
    // Fase 3 (AMARELO): chuva do topo
    () => {
      // Apenas 4 verticais com boa separação
      for (let i = 0; i < 4; i++) {
        const x = 35 + i * 50;
        const correct = i === 2;
        const c = correct ? targetColor : allColors[i % 4];
        const speed = correct ? 0.6 : 1.3;
        colorBattle.bullets.push({ x, y: -8, dx: 0, dy: speed, color: c, size: correct ? 5 : 4, correct, glow: correct });
      }
      // Apenas 1 projétil lateral extra lento
      colorBattle.bullets.push({ x: -8, y: 80, dx: 1.0, dy: 0, color: 'red', size: 4, correct: false });
    }
  ];

  patterns[phase]();
}

function updateColorBattle() {
  if (!colorBattle.active) return;
  if (gameState === 'DIALOGUE' || gameState === 'INVENTORY') return;

  // Intro: aguarda diálogo terminar
  if (colorBattle.showIntro) {
    if (gameState !== 'DIALOGUE') colorBattle.showIntro = false;
    return;
  }

  const cb = colorBattle;
  const soul = cb.soul;
  const bx = 20, by = 30, bw = 200, bh = 120; // Caixa de batalha

  // Mover o soul com as teclas
  if (keysHeld.up && soul.y - soul.size > by) soul.y -= cb.soulSpeed;
  if (keysHeld.down && soul.y + soul.size < by + bh) soul.y += cb.soulSpeed;
  if (keysHeld.left && soul.x - soul.size > bx) soul.x -= cb.soulSpeed;
  if (keysHeld.right && soul.x + soul.size < bx + bw) soul.x += cb.soulSpeed;

  // Mover projéteis e checar colisão
  cb.bullets = cb.bullets.filter(b => {
    b.x += b.dx;
    b.y += b.dy;

    // Remover se saiu da tela
    if (b.x < -20 || b.x > canvas.width + 20 || b.y < -20 || b.y > canvas.height + 20) return false;

    // Colisão com soul
    const dist = Math.hypot(soul.x - b.x, soul.y - b.y);
    if (dist < soul.size + b.size - 1) {
      if (b.correct && room5TargetSequence[cb.phase] === b.color) {
        // Acertou a cor certa!
        cb.collected++;
        cb.phase++;
        cb.bullets = [];
        spawnParticle(b.x, b.y, room5ColorHex[b.color], 20);
        shakeScreen(5);

        if (cb.phase >= room5TargetSequence.length) {
          // VENCEU!
          cb.active = false;
          room5Solved = true;
          maps[5][0][7] = 0;
          showDialogue([
            "A barreira mágica desaparece!",
            "\"Impressionante! Você passou pelo teste das cores!\"",
            "A porta para a Sala do Trono está aberta!"
          ]);
        } else {
          // Próxima onda
          setTimeout(() => spawnBulletsForPhase(cb.phase), 800);
        }
        return false;
      } else if (!b.correct) {
        // Acertou projétil errado: dano!
        damagePlayer(2);
        spawnParticle(b.x, b.y, room5ColorHex[b.color] || '#fff', 8);
        return false;
      }
    }
    return true;
  });

  // Timer da onda: se acabar os projéteis ou acabou o tempo, re-spawna
  cb.waveTimer++;
  if (cb.bullets.length === 0 || cb.waveTimer >= cb.waveMax) {
    cb.waveTimer = 0;
    spawnBulletsForPhase(cb.phase);
  }
}

function drawColorBattle() {
  const cb = colorBattle;
  const bx = 20, by = 30, bw = 200, bh = 120;
  const targetColor = room5TargetSequence[cb.phase];
  const targetHex = room5ColorHex[targetColor];
  const targetName = room5ColorNames[targetColor];

  // Fundo semi-transparente escuro
  ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Caixa de batalha
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#000010';
  ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);

  // Painel de progresso no topo
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(20, 5, 200, 22);
  ctx.strokeStyle = targetHex;
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 5, 200, 22);

  ctx.font = '5px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#aaa';
  ctx.fillText('TOQUE A COR:', 80, 15);
  ctx.fillStyle = targetHex;
  ctx.fillText(targetName, 160, 15);

  // Indicadores de fases (bolinhas)
  for (let i = 0; i < room5TargetSequence.length; i++) {
    const c = room5TargetSequence[i];
    const ix = 35 + i * 45;
    ctx.fillStyle = i < cb.phase ? room5ColorHex[c] : (i === cb.phase ? room5ColorHex[c] : '#333');
    ctx.beginPath();
    ctx.arc(ix, 22, i === cb.phase ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
    if (i === cb.phase) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Desenhar projéteis dentro da caixa
  cb.bullets.forEach(b => {
    if (b.glow) {
      // Brilho externo para projétil correto
      ctx.shadowColor = room5ColorHex[b.color];
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = room5ColorHex[b.color] || b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Borda branca nos projéteis corretos
    if (b.glow) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  // Soul (coração)
  const sx = cb.soul.x, sy = cb.soul.y;
  ctx.fillStyle = '#ff1744';
  ctx.shadowColor = '#ff1744';
  ctx.shadowBlur = 6;
  // Coração pixel
  ctx.fillRect(sx - 3, sy - 1, 2, 2);
  ctx.fillRect(sx + 1, sy - 1, 2, 2);
  ctx.fillRect(sx - 4, sy + 1, 8, 2);
  ctx.fillRect(sx - 3, sy + 3, 6, 2);
  ctx.fillRect(sx - 2, sy + 5, 4, 2);
  ctx.fillRect(sx - 1, sy + 7, 2, 2);
  ctx.shadowBlur = 0;
}

/* ═══════════════════════════════
   COMPORTAMENTO DO CHEFE VITÓRIA
   ═══════════════════════════════ */
function updateVitoriaBoss() {
  if (currentRoom !== 6 || !vitoria.active) return;

  vitoria.floatTimer += 0.05;

  // Movimento errático: Vitória se move lentamente pela sala perseguindo Raicca
  const dx = player.x - vitoria.x;
  const dy = player.y - vitoria.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 40) { // Só persegue se estiver longe
    vitoria.x += (dx / dist) * 0.6;
    vitoria.y += (dy / dist) * 0.6;
  } else {
    // Patrulha lateral se estiver perto
    vitoria.x += Math.sin(vitoria.floatTimer * 1.2) * 0.8;
  }

  // Flutua suavemente no eixo Y
  vitoria.y += Math.sin(vitoria.floatTimer) * 0.5;

  // Limita dentro da sala (evita sair das bordas)
  vitoria.x = Math.max(16, Math.min(224 - 16, vitoria.x));
  vitoria.y = Math.max(20, Math.min(90, vitoria.y));

  vitoria.shootCooldown--;
  if (vitoria.shootCooldown <= 0) {
    vitoria.shootCooldown = 150; // Atira a cada 2.5s (era 90 = 1.5s)
    
    // Atirar coração teleguiado em direção ao jogador
    const angle = Math.atan2(player.y - vitoria.y, player.x - vitoria.x);
    const speed = 1.4;
    projectiles.push({
      x: vitoria.x + 8,
      y: vitoria.y + 8,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      color: '#e91e63',
      size: 4,
      target: 'player'
    });

    // Chance reduzida de summonar guarda
    if (enemies.length < 1 && Math.random() < 0.25) {
      enemies.push({
        x: (Math.random() > 0.5 ? 2 : 12) * 16,
        y: 6 * 16,
        tileX: 0, tileY: 0,
        hp: 3,
        type: 'summon',
        dir: 'up',
        isAggro: true,
        color: '#9c27b0',
        speed: 0.8,
        flashRed: 0
      });
    }
  }

  // Piscar vermelho
  if (vitoria.flashRed > 0) vitoria.flashRed--;
}

function defeatVitoria() {
  vitoria.active = false;
  eduardo.inCage = false;
  projectiles = []; // Limpa todos os projéteis da tela
  enemies = [];    // Limpa guardas summoned
  spawnParticle(vitoria.x + 8, vitoria.y + 8, '#ea80fc', 40);
  shakeScreen(30);
  
  showDialogue([
    "Vitória: \"NÃO! Isso é injusto! Eu só queria ele para mim!\"",
    "\"Por que ninguém me ama com a mesma intensidade que eu amo?...\"",
    "Ela foge chorando para os jardins do castelo, deixando a chave da jaula para trás.",
    "Você salvou o Eduardo!"
  ], () => {
    hideDialogue(); // Esconde a caixa de diálogo enquanto Eduardo caminha
    animateEduardoWalk();
  });
}

function animateEduardoWalk() {
  gameState = 'CUTSCENE'; // Entra em modo cutscene (bloqueia inputs do jogador)
  // Eduardo caminha livre até Raicca
  let walkInterval = setInterval(() => {
    if (eduardo.y < player.y - 16) {
      eduardo.y += 2;
    } else {
      clearInterval(walkInterval);
      showDialogue([
        "Eduardo: \"Muito obrigado minha princesa, você me tirou das garras dessa cadela burra.\"",
        "Eduardo: \"Aishiteru. 💖\""
      ], () => {
        hideDialogue(); // Garante que a caixa de diálogo suma ao iniciar a tela de fim
        gameState = 'WIN';
        setTimeout(() => {
          gameState = 'AISHITERU';
          finalAishiteruCount = 0;
          startAishiteruRain();
        }, 2000);
      });
    }
  }, 100);
}

/* ═══════════════════════════════
   MOTOR GRÁFICO (RENDERIZAÇÃO)
   ═══════════════════════════════ */
function draw() {
  ctx.save();

  // Efeito screen shake
  if (shakeScreenTime > 0) {
    const dx = (Math.random() - 0.5) * 4;
    const dy = (Math.random() - 0.5) * 4;
    ctx.translate(dx, dy);
    shakeScreenTime--;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState === 'INTRO') {
    drawIntroScreen();
  } else if (gameState === 'GAME_OVER') {
    drawGameOverScreen();
  } else if (gameState === 'WIN') {
    drawWinScreen();
  } else if (gameState === 'AISHITERU') {
    drawAishiteruWaterfall();
  } else {
    // Desenhar cenário normal do jogo
    drawMap();
    drawSwitchesAndChests();
    drawBushesAndSpikes();
    drawProjectiles();
    drawEnemies();
    drawPlayer();
    drawVitoriaBoss();
    drawEduardo();
    drawParticles();
    drawHUD();

    // Batalha de cores Undertale (sobrepõe o mapa se ativa)
    if (colorBattle.active) {
      drawColorBattle();
    }

    if (gameState === 'INVENTORY') {
      drawInventoryScreen();
    }
  }

  ctx.restore();
}

function drawIntroScreen() {
  ctx.fillStyle = '#1c0d35';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.font = '8px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText("Raicca's Adventure", canvas.width / 2, 50);
  ctx.font = '6px "Press Start 2P"';
  ctx.fillStyle = '#ff69b4';
  ctx.fillText("GBA Action RPG Edition", canvas.width / 2, 68);

  ctx.fillStyle = '#ffffff';
  ctx.fillText("SALVE O EDUARDO DA VITÓRIA!", canvas.width / 2, 95);

  ctx.fillStyle = '#ff4081';
  ctx.fillText("APENAS APERTE [A] / ENTER", canvas.width / 2, 130);
}

function drawGameOverScreen() {
  // Flash vermelho rápido
  const alpha = 0.7 + Math.sin(Date.now() * 0.01) * 0.3;
  ctx.fillStyle = `rgba(180, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.font = '10px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText("FIM DE JOGO", canvas.width / 2, 70);

  ctx.fillStyle = '#ffcccc';
  ctx.font = '5px "Press Start 2P"';
  ctx.fillText("Reiniciando...", canvas.width / 2, 100);
}

function drawWinScreen() {
  ctx.fillStyle = '#4a148c'; // Roxo romântico
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.font = '12px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText("VOCÊ VENCEU!", canvas.width / 2, 65);
  ctx.font = '6px "Press Start 2P"';
  ctx.fillStyle = '#ea80fc';
  ctx.fillText("Eduardo está seguro ao seu lado.", canvas.width / 2, 90);
}

function drawAishiteruWaterfall() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (finalAishiteruCount >= 60) {
    // Tela yandere final sinistra após 20 segundos de chuva
    ctx.fillStyle = '#ff1744'; // Vermelho sangue
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'center';
    
    const shakeX = (Math.random() - 0.5) * 1.5;
    const shakeY = (Math.random() - 0.5) * 1.5;
    
    ctx.fillText("Olhe somente para mim,", canvas.width / 2 + shakeX, 70 + shakeY);
    ctx.fillText("se não irei arrancar seus olhos.", canvas.width / 2 + shakeX, 85 + shakeY);
  } else {
    // Chuva de Aishiteru rosa
    ctx.fillStyle = '#e91e63'; // Rosa vibrante
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'center';

    const maxLinesOnScreen = 15;
    const startY = 15;
    const spacing = 10;

    for (let i = 0; i < Math.min(finalAishiteruCount, 30); i++) {
      const y = startY + (i % maxLinesOnScreen) * spacing;
      const offsetX = Math.sin(i + finalAishiteruCount * 0.1) * 15;
      ctx.fillText("Aishiteru", (canvas.width / 2) + offsetX, y);
    }
  }

  if (finalAishiteruCount < 60) {
    finalAishiteruCount += 0.05;
  }
}

function drawMap() {
  const map = maps[currentRoom];
  for (let r = 0; r < MAP_HEIGHT; r++) {
    for (let c = 0; c < MAP_WIDTH; c++) {
      const tile = map[r][c];
      const tx = c * TILE_SIZE;
      const ty = r * TILE_SIZE;

      if (tile === 1) {
        // Paredes retrô
        ctx.fillStyle = '#3a2e2b';
        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#28201d';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);
      } else {
        // Chão dependendo da sala
        if (currentRoom === 1) ctx.fillStyle = '#1b3a24'; // Floresta (Verde escuro)
        else if (currentRoom === 2) ctx.fillStyle = '#424242'; // Entrada do Castelo (Cinza)
        else if (currentRoom === 3) ctx.fillStyle = '#3e2723'; // Corredores internos (Marrom escuro)
        else if (currentRoom === 4) ctx.fillStyle = '#263238'; // Masmorra (Cinza Azulado)
        else if (currentRoom === 5) ctx.fillStyle = '#212121'; // Grid
        else if (currentRoom === 6) ctx.fillStyle = '#4a148c'; // Sala do Trono (Roxo)
        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
      }

      // Renderizar piso colorido da Sala 5
      if (currentRoom === 5 && tile === 8) {
        const gc = c - 3;
        const gr = r - 3;
        const color = room5Pisos[gr][gc];
        ctx.fillStyle = color === 'red' ? '#e53935' : (color === 'green' ? '#43a047' : (color === 'blue' ? '#1e88e5' : '#fdd835'));
        ctx.fillRect(tx + 2, ty + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      }

      // Portas Trancadas
      if (tile === 7) {
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
        // Desenha barras de metal
        ctx.fillStyle = '#bdbdbd';
        for (let i = 2; i < 16; i += 4) {
          ctx.fillRect(tx + i, ty, 2, TILE_SIZE);
        }
      }
    }
  }
}

function drawSwitchesAndChests() {
  const map = maps[currentRoom];
  for (let r = 0; r < MAP_HEIGHT; r++) {
    for (let c = 0; c < MAP_WIDTH; c++) {
      const tile = map[r][c];
      const tx = c * TILE_SIZE;
      const ty = r * TILE_SIZE;

      // Baú (Tile 3 na Sala 1)
      if (currentRoom === 1 && tile === 3) {
        ctx.fillStyle = '#8d6e63'; // Madeira
        ctx.fillRect(tx + 2, ty + 4, 12, 10);
        ctx.fillStyle = '#ffd54f'; // Tranca
        ctx.fillRect(tx + 7, ty + 8, 2, 3);
      }

      // Placa (Tile 4)
      if (tile === 4) {
        ctx.fillStyle = '#a1887f';
        ctx.fillRect(tx + 3, ty + 2, 10, 8);
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(tx + 7, ty + 10, 2, 6);
      }

      // Interruptor de Pressão (Tile 5 na Sala 2)
      if (currentRoom === 2 && tile === 5) {
        let swIndex = (c === 2 ? 0 : (c === 6 ? 1 : 2));
        const pressed = room2SwitchesPressed[swIndex];
        ctx.fillStyle = pressed ? '#4caf50' : '#f44336';
        ctx.fillRect(tx + 3, ty + 3, 10, 10);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx + 4, ty + 4, 8, 8);
      }
    }
  }
}

function drawBushesAndSpikes() {
  const map = maps[currentRoom];
  for (let r = 0; r < MAP_HEIGHT; r++) {
    for (let c = 0; c < MAP_WIDTH; c++) {
      const tile = map[r][c];
      const tx = c * TILE_SIZE;
      const ty = r * TILE_SIZE;

      // Arbustos Cortáveis (Tile 2 na Sala 1)
      if (currentRoom === 1 && tile === 2) {
        ctx.fillStyle = '#2e7d32'; // Verde arbusto
        ctx.fillRect(tx + 1, ty + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        ctx.fillStyle = '#1b5e20';
        ctx.fillRect(tx + 3, ty + 3, 4, 4);
        ctx.fillRect(tx + 9, ty + 7, 4, 4);
      }

      // Espinhos Retráteis (Tile 6 na Sala 3)
      if (currentRoom === 3 && tile === 6) {
        const active = (Math.floor(Date.now() / 1000) % 2 === 0);
        ctx.fillStyle = '#757575'; // Fundo do espinho
        ctx.fillRect(tx + 2, ty + 2, 12, 12);
        
        if (active) {
          ctx.fillStyle = '#e0e0e0'; // Espinhos prateados ativos
          ctx.beginPath();
          ctx.moveTo(tx + 4, ty + 14); ctx.lineTo(tx + 6, ty + 4); ctx.lineTo(tx + 8, ty + 14);
          ctx.moveTo(tx + 8, ty + 14); ctx.lineTo(tx + 10, ty + 4); ctx.lineTo(tx + 12, ty + 14);
          ctx.fill();
        }
      }
    }
  }
}

function drawPlayer() {
  // Interpolação suave de movimento (velocidade ideal ajustada para 2.7 pixels por frame)
  if (player.isMoving) {
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const speed = 2.7;

    if (Math.abs(dx) > speed) player.x += Math.sign(dx) * speed;
    else player.x = player.targetX;

    if (Math.abs(dy) > speed) player.y += Math.sign(dy) * speed;
    else player.y = player.targetY;

    if (player.x === player.targetX && player.y === player.targetY) {
      player.isMoving = false;
    }
    
    if (Math.floor(Date.now() / 100) % 2 === 0) {
      player.animFrame = 1;
    } else {
      player.animFrame = 0;
    }
  } else {
    player.animFrame = 0;
  }

  // Piscar de invencibilidade
  if (player.invincibleFrames > 0) {
    player.invincibleFrames--;
    if (Math.floor(player.invincibleFrames / 4) % 2 === 0) return;
  }

  const px = player.x;
  const py = player.y;

  // Renderiza corpo / vestido de Raicca
  ctx.fillStyle = player.flashRed > 0 ? '#ff1744' : player.colorDress;
  if (player.flashRed > 0) player.flashRed--;

  ctx.fillRect(px + 2, py + 6, 12, 8); // Vestido

  // Pernas / Pés se movendo se estiver andando
  ctx.fillStyle = '#111111'; // Sapatos pretos
  if (player.isMoving && player.animFrame === 1) {
    ctx.fillRect(px + 3, py + 14, 3, 2);
    ctx.fillRect(px + 10, py + 14, 3, 2);
  } else {
    ctx.fillRect(px + 4, py + 14, 3, 2);
    ctx.fillRect(px + 9, py + 14, 3, 2);
  }

  // Cabeça
  ctx.fillStyle = player.colorSkin;
  ctx.fillRect(px + 4, py + 1, 8, 6);

  // Cabelo preto cacheado
  ctx.fillStyle = player.colorHair;
  ctx.fillRect(px + 3, py, 10, 2);
  ctx.fillRect(px + 2, py + 1, 2, 6); // lateral esq
  ctx.fillRect(px + 12, py + 1, 2, 6); // lateral dir

  // Olhos dependendo da direção
  ctx.fillStyle = '#000';
  if (player.dir === 'down') {
    ctx.fillRect(px + 5, py + 3, 1, 1);
    ctx.fillRect(px + 10, py + 3, 1, 1);
  } else if (player.dir === 'left') {
    ctx.fillRect(px + 4, py + 3, 1, 1);
  } else if (player.dir === 'right') {
    ctx.fillRect(px + 11, py + 3, 1, 1);
  }

  // Desenhar Ataque da Espada (se ativo) com animação de lâmina cortando
  if (player.isAttacking) {
    player.attackTimer--;
    if (player.attackTimer <= 0) player.isAttacking = false;

    ctx.save();
    
    // Desenha o rastro da lâmina (arco cortante semicircular translúcido)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    
    // Define o progresso do corte (de 0 a 1) para movimentar a lâmina
    const progress = (15 - player.attackTimer) / 15;
    const radius = 14;
    const cx = px + 8;
    const cy = py + 8;

    if (player.attackDir === 'up') {
      // Corte de esquerda para direita acima do jogador
      const startAngle = Math.PI + 0.5 - (progress * 0.2);
      const endAngle = Math.PI * 2 - 0.5 + (progress * 0.2);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
    } else if (player.attackDir === 'down') {
      // Corte abaixo do jogador
      const startAngle = 0.5 - (progress * 0.2);
      const endAngle = Math.PI - 0.5 + (progress * 0.2);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
    } else if (player.attackDir === 'left') {
      // Corte à esquerda
      const startAngle = Math.PI/2 + 0.5 - (progress * 0.2);
      const endAngle = Math.PI*1.5 - 0.5 + (progress * 0.2);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
    } else if (player.attackDir === 'right') {
      // Corte à direita
      const startAngle = -Math.PI/2 + 0.5 - (progress * 0.2);
      const endAngle = Math.PI/2 - 0.5 + (progress * 0.2);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
    }
    
    ctx.stroke();

    // Desenha o brilho interno da lâmina (azul ciano clássico de RPG retrô)
    ctx.strokeStyle = 'rgba(128, 222, 234, 0.9)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}

function drawVitoriaBoss() {
  if (currentRoom !== 6) return;

  const vx = vitoria.x;
  const vy = vitoria.y;

  // Vestido de vilã
  ctx.fillStyle = vitoria.flashRed > 0 ? '#ff1744' : vitoria.colorDress;
  ctx.fillRect(vx + 2, vy + 6, 12, 10);

  // Pele negra
  ctx.fillStyle = vitoria.colorSkin;
  ctx.fillRect(vx + 4, vy + 1, 8, 6);

  // Cabelo cacheado super volumoso (característica)
  ctx.fillStyle = vitoria.colorHair;
  ctx.fillRect(vx + 1, vy - 2, 14, 4); // Topo volumoso
  ctx.fillRect(vx, vy + 2, 3, 7); // Lateral esquerdo
  ctx.fillRect(vx + 13, vy + 2, 3, 7); // Lateral direito

  // Olhos sérios expressando ciúme
  ctx.fillStyle = '#fff';
  ctx.fillRect(vx + 5, vy + 3, 2, 1);
  ctx.fillRect(vx + 9, vy + 3, 2, 1);
  ctx.fillStyle = '#e91e63'; // Iris rosa/ciúme
  ctx.fillRect(vx + 5, vy + 3, 1, 1);
  ctx.fillRect(vx + 9, vy + 3, 1, 1);

  // Nome VITÓRIA flutuando
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(vx - 6, vy - 15, 28, 9);
  ctx.fillStyle = '#ff4081';
  ctx.font = '4px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText("VITÓRIA", vx + 8, vy - 8);

  // Barra de HP do Chefe no topo se ativa
  if (vitoria.active) {
    const width = 100;
    const hpPercent = vitoria.hp / vitoria.maxHp;
    ctx.fillStyle = '#555';
    ctx.fillRect(70, 15, width, 5);
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(70, 15, width * hpPercent, 5);
  }
}

function drawEduardo() {
  if (currentRoom === 3 && !eduardo.visible) return;
  if (currentRoom !== 3 && currentRoom !== 6) return;

  const ex = eduardo.x;
  const ey = eduardo.y;

  // Calças
  ctx.fillStyle = '#2980b9';
  ctx.fillRect(ex + 3, ey + 8, 10, 8);

  // Camisa
  ctx.fillStyle = eduardo.colorClothes;
  ctx.fillRect(ex + 3, ey + 5, 10, 5);

  // Pele
  ctx.fillStyle = eduardo.colorSkin;
  ctx.fillRect(ex + 4, ey + 1, 8, 5);

  // Cabelo
  ctx.fillStyle = eduardo.colorHair;
  ctx.fillRect(ex + 3, ey, 10, 2);

  // Olhos
  ctx.fillStyle = '#000';
  ctx.fillRect(ex + 5, ey + 3, 1, 1);
  ctx.fillRect(ex + 9, ey + 3, 1, 1);

  // Gaiola na Sala 6
  if (currentRoom === 6 && eduardo.inCage) {
    ctx.strokeStyle = '#9e9e9e';
    ctx.lineWidth = 2;
    ctx.strokeRect(ex - 4, ey - 4, 24, 24);
    // Barras verticais
    ctx.fillStyle = '#9e9e9e';
    for (let i = 0; i < 24; i += 6) {
      ctx.fillRect(ex - 4 + i, ey - 4, 2, 24);
    }
  }
}

function drawEnemies() {
  enemies.forEach(enemy => {
    ctx.fillStyle = enemy.flashRed > 0 ? '#ff1744' : enemy.color;
    ctx.fillRect(enemy.x + 2, enemy.y + 4, 12, 12);
    // Olhos vermelhos agressivos
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(enemy.x + 4, enemy.y + 6, 2, 2);
    ctx.fillRect(enemy.x + 10, enemy.y + 6, 2, 2);
  });
}

function drawProjectiles() {
  projectiles.forEach((proj, idx) => {
    proj.x += proj.dx;
    proj.y += proj.dy;

    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
    ctx.fill();

    // Colisão com o jogador
    const px = player.x + 8;
    const py = player.y + 8;
    const dist = Math.hypot(px - proj.x, py - proj.y);

    if (dist < 10) {
      damagePlayer(1); // Meio coração de dano
      projectiles.splice(idx, 1);
    }

    // Limpa projéteis fora da tela
    if (proj.x < 0 || proj.x > canvas.width || proj.y < 0 || proj.y > canvas.height) {
      projectiles.splice(idx, 1);
    }
  });
}

function drawParticles() {
  particles.forEach((part, idx) => {
    part.x += part.vx;
    part.y += part.vy;
    part.alpha -= 0.02;

    if (part.alpha <= 0) {
      particles.splice(idx, 1);
    } else {
      ctx.fillStyle = part.color;
      ctx.globalAlpha = part.alpha;
      ctx.fillRect(part.x, part.y, part.size, part.size);
      ctx.globalAlpha = 1.0;
    }
  });
}

function spawnParticle(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      alpha: 1.0,
      size: Math.random() * 3 + 1,
      color: color
    });
  }
}

// HUD: 6 Corações e Slot Equipado
function drawHUD() {
  // Corações
  for (let i = 0; i < 6; i++) {
    const hx = 5 + i * 12;
    const hy = 5;
    const hpVal = player.hp - i * 2;

    ctx.fillStyle = '#ff1744';
    if (hpVal >= 2) {
      // Coração cheio
      ctx.fillRect(hx + 2, hy, 3, 2); ctx.fillRect(hx + 7, hy, 3, 2);
      ctx.fillRect(hx, hy + 2, 12, 4);
      ctx.fillRect(hx + 2, hy + 6, 8, 2);
      ctx.fillRect(hx + 4, hy + 8, 4, 2);
    } else if (hpVal === 1) {
      // Meio coração
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(hx + 2, hy, 3, 2);
      ctx.fillRect(hx, hy + 2, 6, 4);
      ctx.fillRect(hx + 2, hy + 6, 4, 2);
      ctx.fillRect(hx + 4, hy + 8, 2, 2);
      // Metade preta
      ctx.fillStyle = '#333';
      ctx.fillRect(hx + 7, hy, 3, 2);
      ctx.fillRect(hx + 6, hy + 2, 6, 4);
      ctx.fillRect(hx + 6, hy + 6, 4, 2);
    } else {
      // Coração vazio
      ctx.fillStyle = '#333';
      ctx.fillRect(hx + 2, hy, 3, 2); ctx.fillRect(hx + 7, hy, 3, 2);
      ctx.fillRect(hx, hy + 2, 12, 4);
      ctx.fillRect(hx + 2, hy + 6, 8, 2);
      ctx.fillRect(hx + 4, hy + 8, 4, 2);
    }
  }

  // Caixa de item equipado (Canto superior direito)
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(215, 5, 20, 20);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(215, 5, 20, 20);

  if (equippedItemIndex !== -1 && inventory[equippedItemIndex]) {
    const item = inventory[equippedItemIndex];
    if (item.type === 'weapon') {
      // Espada prateada
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(224, 8, 2, 10);
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(223, 16, 4, 2);
    } else if (item.type === 'heal') {
      // Poção vermelha
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(222, 12, 6, 8);
      ctx.fillStyle = '#fff';
      ctx.fillRect(224, 8, 2, 4);
    } else if (item.type === 'key') {
      // Chave amarela
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(220, 10, 10, 2);
      ctx.fillRect(228, 12, 2, 4);
    }
  }
}

function drawInventoryScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(20, 20, 200, 120);

  ctx.strokeStyle = '#ff4081';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 200, 120);

  ctx.fillStyle = '#fff';
  ctx.font = '6px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText("INVENTÁRIO (SELECT)", 120, 32);

  // Slots de inventário (grid 4x2)
  for (let i = 0; i < 8; i++) {
    const sx = 35 + (i % 4) * 44;
    const sy = 45 + Math.floor(i / 4) * 35;

    ctx.fillStyle = '#222';
    ctx.fillRect(sx, sy, 32, 28);
    ctx.strokeStyle = (i === inventorySelectedIndex) ? '#ffeb3b' : '#555';
    ctx.lineWidth = (i === inventorySelectedIndex) ? 2 : 1;
    ctx.strokeRect(sx, sy, 32, 28);

    // Desenha item se houver
    if (inventory[i]) {
      const item = inventory[i];
      if (item.type === 'weapon') {
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(sx + 15, sy + 6, 2, 14);
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(sx + 13, sy + 16, 6, 2);
      } else if (item.type === 'heal') {
        ctx.fillStyle = '#ff1744';
        ctx.fillRect(sx + 12, sy + 12, 8, 10);
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx + 15, sy + 6, 2, 6);
      } else if (item.type === 'key') {
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(sx + 10, sy + 12, 12, 3);
        ctx.fillRect(sx + 18, sy + 15, 3, 6);
      }
    }
  }

  // Descrição do item selecionado
  const item = inventory[inventorySelectedIndex];
  if (item) {
    ctx.fillStyle = '#ffeb3b';
    ctx.font = '5px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillText(item.name, 30, 120);
    ctx.fillStyle = '#aaa';
    ctx.fillText(item.desc.substring(0, 36), 30, 130);
  } else {
    ctx.fillStyle = '#777';
    ctx.font = '5px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText("Slot Vazio", 120, 125);
  }
}

/* ═══════════════════════════════
   SISTEMA DE DIÁLOGOS
   ═══════════════════════════════ */
function showDialogue(lines, callback = null) {
  // Limpa direções seguradas ao abrir diálogo
  keysHeld.up = false;
  keysHeld.down = false;
  keysHeld.left = false;
  keysHeld.right = false;

  dialogueQueue = [...lines];
  dialogueCallback = callback;
  
  previousGameState = gameState;
  gameState = 'DIALOGUE';
  
  dlgBox.classList.remove('hidden');
  dlgArrow.classList.remove('hidden');
  nextDialogue();
}

function nextDialogue() {
  if (dialogueQueue.length === 0) {
    if (dialogueCallback) {
      const cb = dialogueCallback;
      dialogueCallback = null; // Evita que o callback seja disparado múltiplas vezes por cliques seguidos
      cb();
    } else {
      hideDialogue();
      gameState = `ROOM_${currentRoom}`;
    }
    return;
  }

  const text = dialogueQueue.shift();
  typeText(text);
}

function typeText(text) {
  isTyping = true;
  textToType = text;
  textIndex = 0;
  dlgText.textContent = "";
  dlgArrow.classList.add('hidden');
  clearTimeout(dialogueAutoCloseTimeout);
  
  function type() {
    if (textIndex < textToType.length) {
      dlgText.textContent += textToType.charAt(textIndex);
      textIndex++;
      setTimeout(type, 15);
    } else {
      isTyping = false;
      dlgArrow.classList.remove('hidden');
      dialogueAutoCloseTimeout = setTimeout(nextDialogue, 4000); // Avanço automático
    }
  }
  type();
}

function hideDialogue() {
  clearTimeout(dialogueAutoCloseTimeout);
  dlgBox.classList.add('hidden');
  hideInput();
}

function showInput(placeholder, callback) {
  gameState = 'INPUT';
  clearTimeout(dialogueAutoCloseTimeout);
  dlgArrow.classList.add('hidden');
  dlgInputArea.classList.remove('hidden');
  dlgTextInput.placeholder = placeholder;
  dlgTextInput.value = "";
  dlgTextInput.focus();

  dlgBtnSubmit.onclick = () => {
    const value = dlgTextInput.value.trim();
    if (!value) return;
    hideDialogue();
    callback(value);
  };
}

function hideInput() {
  dlgInputArea.classList.add('hidden');
  dlgTextInput.blur();
}

function startAishiteruRain() {
  if (aishiteruRainInterval) return;
  aishiteruRainInterval = setInterval(() => {
    if (gameState !== 'AISHITERU') {
      stopAishiteruRain();
      return;
    }
    const el = document.createElement('div');
    el.className = 'floating-aishiteru';
    el.textContent = 'Aishiteru';
    el.style.left = (Math.random() * 90 + 5) + 'vw';
    el.style.fontSize = (Math.random() * 12 + 10) + 'px';
    el.style.animationDuration = (Math.random() * 4 + 4) + 's';
    el.style.opacity = Math.random() * 0.7 + 0.3;
    document.body.appendChild(el);
    
    setTimeout(() => el.remove(), 8000);
  }, 850);
}

function stopAishiteruRain() {
  if (aishiteruRainInterval) {
    clearInterval(aishiteruRainInterval);
    aishiteruRainInterval = null;
  }
  document.querySelectorAll('.floating-aishiteru').forEach(el => el.remove());
}

/* ═══════════════════════════════
   MAPEAMENTO DOS CONTROLES DO GBA (TECLADO / CELULAR)
   ═══════════════════════════════ */
window.addEventListener('keydown', (e) => {
  if (document.activeElement === dlgTextInput) {
    if (e.key === 'Enter') handleButtonA();
    return;
  }

  const key = e.key.toLowerCase();

  // Direcionais
  if (gameState === 'INVENTORY') {
    if (key === 'arrowleft' || key === 'a') inventorySelectedIndex = Math.max(0, inventorySelectedIndex - 1);
    if (key === 'arrowright' || key === 'd') inventorySelectedIndex = Math.min(inventory.length - 1, inventorySelectedIndex + 1);
    if (key === 'arrowup' || key === 'w') inventorySelectedIndex = Math.max(0, inventorySelectedIndex - 4);
    if (key === 'arrowdown' || key === 's') inventorySelectedIndex = Math.min(inventory.length - 1, inventorySelectedIndex + 4);
  } else {
    if (key === 'arrowup' || key === 'w') keysHeld.up = true;
    else if (key === 'arrowdown' || key === 's') keysHeld.down = true;
    else if (key === 'arrowleft' || key === 'a') keysHeld.left = true;
    else if (key === 'arrowright' || key === 'd') keysHeld.right = true;
  }

  if (key === 'z' || key === 'enter') handleButtonA();
  if (key === 'x' || key === 'backspace') handleButtonB();
  if (key === 'c' || key === 'shift') toggleInventory(); // SELECT
  if (key === 'v' || key === 'escape') restartGame(); // START
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'arrowup' || key === 'w') keysHeld.up = false;
  if (key === 'arrowdown' || key === 's') keysHeld.down = false;
  if (key === 'arrowleft' || key === 'a') keysHeld.left = false;
  if (key === 'arrowright' || key === 'd') keysHeld.right = false;
});

window.addEventListener('blur', () => {
  keysHeld.up = false;
  keysHeld.down = false;
  keysHeld.left = false;
  keysHeld.right = false;
});

// Controles Virtuais de Toque (Celular)
function bindTouch(btnId, action) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    action();
  }, { passive: false });

  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    action();
  });
}

function bindMovementTouch(btnId, dir) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  const startPress = (e) => {
    e.preventDefault();
    if (gameState === 'INVENTORY') {
      if (dir === 'up') inventorySelectedIndex = Math.max(0, inventorySelectedIndex - 4);
      else if (dir === 'down') inventorySelectedIndex = Math.min(inventory.length - 1, inventorySelectedIndex + 4);
      else if (dir === 'left') inventorySelectedIndex = Math.max(0, inventorySelectedIndex - 1);
      else if (dir === 'right') inventorySelectedIndex = Math.min(inventory.length - 1, inventorySelectedIndex + 1);
    } else {
      keysHeld[dir] = true;
    }
  };

  const endPress = (e) => {
    e.preventDefault();
    keysHeld[dir] = false;
  };

  btn.addEventListener('touchstart', startPress, { passive: false });
  btn.addEventListener('touchend', endPress, { passive: false });
  btn.addEventListener('touchcancel', endPress, { passive: false });

  btn.addEventListener('mousedown', startPress);
  btn.addEventListener('mouseup', endPress);
  btn.addEventListener('mouseleave', endPress);
}

bindMovementTouch('btn-up', 'up');
bindMovementTouch('btn-down', 'down');
bindMovementTouch('btn-left', 'left');
bindMovementTouch('btn-right', 'right');

bindTouch('btn-a', handleButtonA);
bindTouch('btn-b', handleButtonB);
bindTouch('btn-select', toggleInventory);
bindTouch('btn-start', restartGame);

/* ═══════════════════════════════
   LOOP DE RENDERIZAÇÃO E GAMEPLAY
   ═══════════════════════════════ */
function gameLoop() {
  // Processa movimentação contínua de teclas ou botões virtuais segurados
  if (gameState === `ROOM_${currentRoom}` && !player.isMoving && !player.isAttacking && !colorBattle.active) {
    if (keysHeld.up) movePlayer(0, -1, 'up');
    else if (keysHeld.down) movePlayer(0, 1, 'down');
    else if (keysHeld.left) movePlayer(-1, 0, 'left');
    else if (keysHeld.right) movePlayer(1, 0, 'right');
  }

  updateColorBattle();
  updateEnemies();
  updateVitoriaBoss();
  draw();
  requestAnimationFrame(gameLoop);
}

// Inicia o game
initGame();
gameLoop();
