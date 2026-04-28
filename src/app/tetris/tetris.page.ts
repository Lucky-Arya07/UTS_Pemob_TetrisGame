import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

const SHAPES = [
  [],
  [[1, 1, 1, 1]], // I
  [[1, 1, 1], [0, 1, 0]], // T
  [[1, 1, 1], [1, 0, 0]], // L
  [[1, 1, 1], [0, 0, 1]], // J
  [[1, 1, 0], [0, 1, 1]], // S
  [[0, 1, 1], [1, 1, 0]], // Z
  [[1, 1], [1, 1]], // O
];

const COLORS = ['none', '#00f0f0', '#a000f0', '#f0a000', '#0000f0', '#00f000', '#f00000', '#f0f000'];

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

  ROWS = 20; COLS = 10; BLOCK = 30;
  grid: number[][] = [];
  score = 0; level = 1;
  highScore = Number(localStorage.getItem('highScore') || 0);

  gameStarted = false; showSettings = false;
  gameOver = false; paused = false;

  musicVolume = 0.4; sfxVolume = 0.5;
  gameInterval: any;
  bag: number[] = [];

  activePiece = { matrix: [] as number[][], pos: { x: 0, y: 0 }, colorId: 0 };
  ghostPos = { x: 0, y: 0 };
  holdPiece: any = null;
  canHold = true;

  // 🔊 Audio
  bgMusicList: HTMLAudioElement[] = [];
  currentMusic!: HTMLAudioElement;
  rotateSound = new Audio('assets/sound/rotate.mp3');
  clearSound = new Audio('assets/sound/clear.mp3');

  shakeTime = 0; shakeIntensity = 8;

  constructor() { this.grid = this.emptyGrid(); }

  ngOnInit() { this.initAudio(); }
  ngOnDestroy() { this.stopGameLogic(); }

  initAudio() {
    this.bgMusicList = [
      new Audio('assets/sound/backsound1.mp3'),
      new Audio('assets/sound/backsound2.mp3'),
      new Audio('assets/sound/backsound3.mp3'),
      new Audio('assets/sound/backsound4.mp3')
    ];
    this.bgMusicList.forEach(m => m.load());
  }

  playMusic() {
    this.stopMusic();
    const randomIndex = Math.floor(Math.random() * this.bgMusicList.length);
    this.currentMusic = this.bgMusicList[randomIndex];
    this.currentMusic.volume = this.musicVolume;
    
    // Auto-next saat lagu habis
    this.currentMusic.onended = () => this.playMusic();
    
    this.currentMusic.play().catch(() => console.log("Audio waiting for interaction"));
  }

  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
    }
  }

  updateVolume() {
    if (this.currentMusic) this.currentMusic.volume = this.musicVolume;
  }

  emptyGrid() { return Array.from({ length: this.ROWS }, () => Array(this.COLS).fill(0)); }

  generateBag() {
    const newBag = [1, 2, 3, 4, 5, 6, 7];
    for (let i = newBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
    }
    return newBag;
  }

  getNextId() {
    if (this.bag.length === 0) this.bag = this.generateBag();
    return this.bag.pop()!;
  }

  startButton() {
    this.gameStarted = true;
    this.resetState();
    setTimeout(() => {
      this.initCanvas();
      this.spawnPiece();
      this.updateSpeed();
      this.playMusic();
      this.loop();
    });
  }

  restartGame() {
    this.resetState();
    this.spawnPiece();
    this.updateSpeed();
    this.playMusic();
  }

  resetState() {
    this.grid = this.emptyGrid();
    this.score = 0; this.level = 1;
    this.gameOver = false; this.paused = false;
    this.holdPiece = null; this.bag = [];
  }

  initCanvas() {
    this.ctx = this.canvas.nativeElement.getContext('2d')!;
    this.canvas.nativeElement.width = this.COLS * this.BLOCK;
    this.canvas.nativeElement.height = this.ROWS * this.BLOCK;
  }

  spawnPiece() {
    const id = this.getNextId();
    this.activePiece.matrix = JSON.parse(JSON.stringify(SHAPES[id]));
    this.activePiece.colorId = id;
    this.activePiece.pos = { x: Math.floor(this.COLS / 2) - 1, y: 0 };

    if (this.checkCollision(this.activePiece.pos)) {
      this.gameOver = true;
      this.stopGameLogic();
      this.shakeTime = 30;
    }
    this.canHold = true;
    this.updateGhost();
  }

  checkCollision(pos: any): boolean {
    const m = this.activePiece.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x]) {
          const nx = x + pos.x;
          const ny = y + pos.y;
          if (nx < 0 || nx >= this.COLS || ny >= this.ROWS || (ny >= 0 && this.grid[ny][nx])) return true;
        }
      }
    }
    return false;
  }

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
          const ny = y + this.activePiece.pos.y;
          if (ny >= 0) this.grid[ny][x + this.activePiece.pos.x] = this.activePiece.colorId;
        }
      });
    });
  }

  clearLines() {
    let cleared = 0;
    for (let y = this.ROWS - 1; y >= 0; y--) {
      if (this.grid[y].every(v => v !== 0)) {
        this.grid.splice(y, 1);
        this.grid.unshift(Array(this.COLS).fill(0));
        cleared++; y++;
      }
    }
    if (cleared > 0) {
      this.score += cleared * 100;
      this.level = Math.floor(this.score / 500) + 1;
      this.shakeTime = 12;
      this.clearSound.volume = this.sfxVolume;
      this.clearSound.play().catch(() => {});
      this.updateSpeed();
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('highScore', String(this.highScore));
      }
    }
  }

  updateSpeed() {
    clearInterval(this.gameInterval);
    const speed = Math.max(100, 800 - (this.level - 1) * 75);
    this.gameInterval = setInterval(() => this.drop(), speed);
  }

  moveLeft() { if(!this.paused && !this.gameOver) { this.activePiece.pos.x--; if (this.checkCollision(this.activePiece.pos)) this.activePiece.pos.x++; this.updateGhost(); } }
  moveRight() { if(!this.paused && !this.gameOver) { this.activePiece.pos.x++; if (this.checkCollision(this.activePiece.pos)) this.activePiece.pos.x--; this.updateGhost(); } }
  rotate() {
    if(this.paused || this.gameOver) return;
    const m = this.activePiece.matrix;
    const r = m[0].map((_, i) => m.map(row => row[i]).reverse());
    const prev = this.activePiece.matrix;
    this.activePiece.matrix = r;
    if (this.checkCollision(this.activePiece.pos)) this.activePiece.matrix = prev;
    this.rotateSound.volume = this.sfxVolume;
    this.rotateSound.play().catch(() => {});
    this.updateGhost();
  }
  
  hold() {
    if (!this.canHold || this.paused || this.gameOver) return;
    if (!this.holdPiece) {
      this.holdPiece = { matrix: JSON.parse(JSON.stringify(SHAPES[this.activePiece.colorId])), id: this.activePiece.colorId };
      this.spawnPiece();
    } else {
      const current = { matrix: JSON.parse(JSON.stringify(SHAPES[this.activePiece.colorId])), id: this.activePiece.colorId };
      this.activePiece.matrix = this.holdPiece.matrix;
      this.activePiece.colorId = this.holdPiece.id;
      this.activePiece.pos = { x: 3, y: 0 };
      this.holdPiece = current;
    }
    this.canHold = false;
    this.updateGhost();
  }

  updateGhost() {
    this.ghostPos = { ...this.activePiece.pos };
    while (!this.checkCollision(this.ghostPos)) { this.ghostPos.y++; }
    this.ghostPos.y--;
  }

  loop() {
    if (this.gameStarted) {
      this.draw();
      requestAnimationFrame(() => this.loop());
    }
  }

  draw() {
    let sx = 0, sy = 0;
    if (this.shakeTime > 0) {
      sx = (Math.random() - 0.5) * this.shakeIntensity;
      sy = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeTime--;
    }
    this.ctx.setTransform(1, 0, 0, 1, sx, sy);
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.COLS * this.BLOCK, this.ROWS * this.BLOCK);

    this.grid.forEach((row, y) => row.forEach((v, x) => {
      if (v) { this.ctx.fillStyle = COLORS[v]; this.ctx.fillRect(x * this.BLOCK, y * this.BLOCK, this.BLOCK - 1, this.BLOCK - 1); }
    }));

    if (!this.gameOver) {
      this.activePiece.matrix.forEach((row, y) => row.forEach((v, x) => {
        if (v) {
          this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
          this.ctx.fillRect((x + this.ghostPos.x) * this.BLOCK, (y + this.ghostPos.y) * this.BLOCK, this.BLOCK - 1, this.BLOCK - 1);
          this.ctx.fillStyle = COLORS[this.activePiece.colorId];
          this.ctx.fillRect((x + this.activePiece.pos.x) * this.BLOCK, (y + this.activePiece.pos.y) * this.BLOCK, this.BLOCK - 1, this.BLOCK - 1);
        }
      }));
    }
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) { clearInterval(this.gameInterval); this.stopMusic(); }
    else { this.updateSpeed(); this.playMusic(); }
  }

  backToMenu() { this.gameStarted = false; this.stopGameLogic(); }
  stopGameLogic() { clearInterval(this.gameInterval); this.stopMusic(); }
}