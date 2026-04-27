import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

const SHAPES = [
  [],
  [[1,1,1,1]],
  [[1,1,1],[0,1,0]],
  [[1,1,1],[1,0,0]],
  [[1,1,1],[0,0,1]],
  [[1,1,0],[0,1,1]],
  [[0,1,1],[1,1,0]],
  [[1,1],[1,1]],
];

const COLORS = [
  'none',
  '#00f0f0','#a000f0','#f0a000',
  '#0000f0','#00f000','#f00000','#f0f000'
];

@Component({
  selector: 'app-tetris',
  templateUrl: './tetris.page.html',
  styleUrls: ['./tetris.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class TetrisPage implements OnInit, OnDestroy {

  @ViewChild('board') canvas!: ElementRef<HTMLCanvasElement>;
  ctx!: CanvasRenderingContext2D;

  ROWS = 20;
  COLS = 10;
  BLOCK = 30;

  grid: number[][] = [];

  score = 0;
  level = 1;
  highScore = Number(localStorage.getItem('highScore') || 0);

  gameStarted = false;
  showSettings = false;
  gameOver = false;

  paused = false;

  musicVolume = 0.4;
  sfxVolume = 0.5;

  gameInterval: any;

  // 🎮 PIECE
  activePiece = {
    matrix: [] as number[][],
    pos: { x: 0, y: 0 },
    colorId: 0
  };

  ghostPos = { x: 0, y: 0 };
  holdPiece: any = null;
  canHold = true;

  // 🎵 AUDIO
  bgMusicList: HTMLAudioElement[] = [];
  currentMusic!: HTMLAudioElement;

  rotateSound!: HTMLAudioElement;
  clearSound!: HTMLAudioElement;

  // ✨ EFFECTS
  shakeTime = 0;
  shakeIntensity = 6;

  // smooth drop (opsional)
  renderOffsetY = 0;
  fallSpeed = 0.25;

  constructor() {
    this.grid = this.emptyGrid();
  }

  // 🔊 AUDIO
  initAudio() {
    this.bgMusicList = [
      new Audio('assets/sound/backsound1.mp3'),
      new Audio('assets/sound/backsound2.mp3'),
      new Audio('assets/sound/backsound3.mp3'),
      new Audio('assets/sound/backsound4.mp3'),
    ];

    this.rotateSound = new Audio('assets/sound/rotate.mp3');
    this.clearSound = new Audio('assets/sound/clear.mp3');
  }

  unlockAudio() {
    const a = new Audio('assets/sound/rotate.mp3');
    a.volume = 0;
    a.play().then(() => a.pause()).catch(() => {});
  }

  ngOnInit() {
    this.initAudio();
  }

  ngOnDestroy() {
    clearInterval(this.gameInterval);
    this.stopMusic();
  }

  emptyGrid() {
    return Array.from({ length: this.ROWS }, () =>
      Array(this.COLS).fill(0)
    );
  }

  // 🎮 START
  startButton() {
    this.unlockAudio();

    this.gameStarted = true;
    this.gameOver = false;
    this.paused = false;

    setTimeout(() => {
      this.initCanvas();
      this.startGame();
      this.playMusic();
      this.loop();
    });
  }

  backToMenu() {
    this.gameStarted = false;
    this.gameOver = false;

    clearInterval(this.gameInterval);
    this.stopMusic();

    this.grid = this.emptyGrid();
  }

  initCanvas() {
    this.ctx = this.canvas.nativeElement.getContext('2d')!;
    this.canvas.nativeElement.width = this.COLS * this.BLOCK;
    this.canvas.nativeElement.height = this.ROWS * this.BLOCK;
  }

  startGame() {
    this.grid = this.emptyGrid();
    this.score = 0;
    this.level = 1;

    this.spawnPiece();
    this.updateSpeed();
  }

  spawnPiece() {
    const id = Math.floor(Math.random() * (SHAPES.length - 1)) + 1;

    this.activePiece.matrix = SHAPES[id];
    this.activePiece.colorId = id;

    this.activePiece.pos = { x: 3, y: 0 };

    this.canHold = true;
  }

  // 👻 GHOST
  updateGhost() {
    this.ghostPos = { ...this.activePiece.pos };

    while (!this.checkCollision(this.ghostPos)) {
      this.ghostPos.y++;
    }
    this.ghostPos.y--;
  }

  // 🚨 COLLISION AMAN
  checkCollision(pos: any): boolean {
    const m = this.activePiece.matrix;

    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x]) {
          const nx = x + pos.x;
          const ny = y + pos.y;

          if (
            nx < 0 ||
            nx >= this.COLS ||
            ny >= this.ROWS ||
            (ny >= 0 && this.grid[ny][nx] !== 0)
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // 🎮 MOVE FIX
  moveLeft() {
    this.activePiece.pos.x--;

    if (this.checkCollision(this.activePiece.pos)) {
      this.activePiece.pos.x++;
    }
  }

  moveRight() {
    this.activePiece.pos.x++;

    if (this.checkCollision(this.activePiece.pos)) {
      this.activePiece.pos.x--;
    }
  }

  // 🔄 ROTATE FIX
  rotate() {
    const m = this.activePiece.matrix;
    const rotated = m[0].map((_, i) => m.map(r => r[i]).reverse());

    const oldMatrix = this.activePiece.matrix;
    const oldX = this.activePiece.pos.x;

    this.activePiece.matrix = rotated;

    // wall kick sederhana
    if (this.checkCollision(this.activePiece.pos)) {
      this.activePiece.pos.x = oldX - 1;

      if (this.checkCollision(this.activePiece.pos)) {
        this.activePiece.pos.x = oldX + 1;

        if (this.checkCollision(this.activePiece.pos)) {
          this.activePiece.matrix = oldMatrix;
          this.activePiece.pos.x = oldX;
        }
      }
    }
  }

  // 🎮 HOLD
  hold() {
    if (!this.canHold) return;

    if (!this.holdPiece) {
      this.holdPiece = this.activePiece;
      this.spawnPiece();
    } else {
      const temp = this.activePiece;
      this.activePiece = this.holdPiece;
      this.holdPiece = temp;
    }

    this.canHold = false;
  }

  // 🎯 DROP
  drop() {
    if (this.paused || this.gameOver) return;

    this.activePiece.pos.y++;

    if (this.checkCollision(this.activePiece.pos)) {
      this.activePiece.pos.y--;
      this.merge();
      this.clearLines();
      this.spawnPiece();
    }

    this.updateGhost();
  }

  merge() {
    this.activePiece.matrix.forEach((row, y) => {
      row.forEach((v, x) => {
        if (v) {
          this.grid[y + this.activePiece.pos.y][x + this.activePiece.pos.x] =
            this.activePiece.colorId;
        }
      });
    });
  }

  // 💥 CLEAR + SHAKE
  clearLines() {
    let rows: number[] = [];

    for (let y = 0; y < this.ROWS; y++) {
      if (this.grid[y].every(v => v)) rows.push(y);
    }

    if (rows.length === 0) return;

    this.shakeTime = 12;

    this.clearSound.currentTime = 0;
    this.clearSound.play().catch(() => {});

    rows.forEach(y => {
      this.grid.splice(y, 1);
      this.grid.unshift(Array(this.COLS).fill(0));
    });

    this.score += rows.length * 100;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('highScore', String(this.highScore));
    }

    this.level = Math.floor(this.score / 500) + 1;
    this.updateSpeed();
  }

  updateSpeed() {
    clearInterval(this.gameInterval);

    const speed = Math.max(100, 800 - (this.level - 1) * 70);

    this.gameInterval = setInterval(() => this.drop(), speed);
  }

  // 🔁 LOOP RENDER
  loop() {
    requestAnimationFrame(() => this.loop());

    this.draw();
  }

  // 🎨 DRAW + SHAKE
  draw() {
    let shakeX = 0;
    let shakeY = 0;

    if (this.shakeTime > 0) {
      shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeTime--;
    }

    this.ctx.setTransform(1, 0, 0, 1, shakeX, shakeY);

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.COLS * this.BLOCK, this.ROWS * this.BLOCK);

    // GRID
    for (let y = 0; y < this.ROWS; y++) {
      for (let x = 0; x < this.COLS; x++) {
        const v = this.grid[y][x];

        if (v) {
          this.ctx.fillStyle = COLORS[v];
          this.ctx.fillRect(x * this.BLOCK, y * this.BLOCK, this.BLOCK, this.BLOCK);
        }
      }
    }

    // GHOST
    this.activePiece.matrix.forEach((row, y) => {
      row.forEach((v, x) => {
        if (v) {
          this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
          this.ctx.fillRect(
            (x + this.ghostPos.x) * this.BLOCK,
            (y + this.ghostPos.y) * this.BLOCK,
            this.BLOCK,
            this.BLOCK
          );
        }
      });
    });

    // PIECE
    this.activePiece.matrix.forEach((row, y) => {
      row.forEach((v, x) => {
        if (v) {
          this.ctx.fillStyle = COLORS[this.activePiece.colorId];
          this.ctx.fillRect(
            (x + this.activePiece.pos.x) * this.BLOCK,
            (y + this.activePiece.pos.y) * this.BLOCK,
            this.BLOCK,
            this.BLOCK
          );
        }
      });
    });

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // 🔊 SETTINGS
  updateVolume() {
    this.bgMusicList.forEach(m => m.volume = this.musicVolume);
    this.rotateSound.volume = this.sfxVolume;
    this.clearSound.volume = this.sfxVolume;
  }

  togglePause() {
    this.paused = !this.paused;

    if (this.paused) {
      clearInterval(this.gameInterval);
      this.stopMusic();
    } else {
      this.updateSpeed();
      this.playMusic();
    }
  }

  // 🎵 MUSIC
  playMusic() {
    const i = Math.floor(Math.random() * this.bgMusicList.length);
    this.currentMusic = this.bgMusicList[i];

    this.currentMusic.onended = () => this.playMusic();
    this.currentMusic.play().catch(() => {});
  }

  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
    }
  }
}