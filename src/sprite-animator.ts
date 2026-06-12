export type SpriteAnimationState = 'idle' | 'walk' | 'travel' | 'react';

const CANVAS_SIZE = 96;
const STATE_FRAME_MS: Record<SpriteAnimationState, number> = {
	idle: 420,
	walk: 150,
	travel: 110,
	react: 120,
};

export class PokemonSpriteAnimator {
	private canvas: HTMLCanvasElement;
	private context: CanvasRenderingContext2D;
	private image = new Image();
	private imageLoaded = false;
	private state: SpriteAnimationState = 'idle';
	private frame = 0;
	private lastFrameAt = 0;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.canvas.width = CANVAS_SIZE;
		this.canvas.height = CANVAS_SIZE;
		const context = this.canvas.getContext('2d');
		if (!context) {
			throw new Error('Pokemon pet could not create a sprite canvas.');
		}
		this.context = context;
		this.context.imageSmoothingEnabled = false;
	}

	load(src: string): void {
		if (this.image.src === src && this.imageLoaded) {
			return;
		}

		this.imageLoaded = false;
		this.frame = 0;
		this.image = new Image();
		this.image.onload = () => {
			this.imageLoaded = true;
			this.draw();
		};
		this.image.src = src;
	}

	setState(state: SpriteAnimationState): void {
		if (state === this.state) {
			return;
		}
		this.state = state;
		this.frame = 0;
		this.lastFrameAt = 0;
		this.draw();
	}

	tick(now: number): void {
		if (!this.imageLoaded) {
			return;
		}

		if (now - this.lastFrameAt < STATE_FRAME_MS[this.state]) {
			return;
		}

		this.lastFrameAt = now;
		this.frame += 1;
		this.draw();
	}

	private draw(): void {
		this.context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		if (!this.imageLoaded) {
			return;
		}

		if (this.state === 'walk') {
			this.drawWalkFrame();
		} else if (this.state === 'travel') {
			this.drawTravelFrame();
		} else if (this.state === 'react') {
			this.drawReactFrame();
		} else {
			this.drawIdleFrame();
		}
	}

	private drawIdleFrame(): void {
		const pose = this.getPose();
		const lift = this.frame % 4 === 2 ? -1 : 0;
		this.drawSprite(pose.x, pose.y + lift, pose.width, pose.height);
	}

	private drawWalkFrame(): void {
		const pose = this.getPose();
		const step = this.frame % 4;
		const lowerStart = Math.floor(this.image.height * 0.58);
		const lowerHeight = this.image.height - lowerStart;
		const sourceMid = Math.floor(this.image.width / 2);
		const destLowerY = pose.y + Math.round((lowerStart / this.image.height) * pose.height);
		const destLowerHeight = Math.ceil((lowerHeight / this.image.height) * pose.height);
		const destMid = pose.x + Math.round(pose.width / 2);
		const footShift = step === 0 ? 0 : step === 1 ? 2 : step === 2 ? 0 : -2;
		const bodyLift = step === 1 || step === 3 ? -1 : 0;

		this.drawSprite(pose.x, pose.y + bodyLift, pose.width, destLowerY - pose.y, 0, 0, this.image.width, lowerStart);
		this.drawSprite(
			pose.x - footShift,
			destLowerY,
			Math.ceil(pose.width / 2),
			destLowerHeight,
			0,
			lowerStart,
			sourceMid,
			lowerHeight,
		);
		this.drawSprite(
			destMid + footShift,
			destLowerY,
			Math.ceil(pose.width / 2),
			destLowerHeight,
			sourceMid,
			lowerStart,
			this.image.width - sourceMid,
			lowerHeight,
		);
	}

	private drawTravelFrame(): void {
		const pose = this.getPose();
		const frame = this.frame % 3;
		const lift = frame === 1 ? -3 : frame === 2 ? -1 : 0;
		this.drawSprite(pose.x, pose.y + lift, pose.width, pose.height);
		this.context.globalAlpha = 0.32;
		this.drawSprite(pose.x - 6, pose.y + 3, pose.width, pose.height);
		this.context.globalAlpha = 1;
	}

	private drawReactFrame(): void {
		const pose = this.getPose();
		const frame = this.frame % 4;
		const headStart = Math.floor(this.image.height * 0.48);
		const headLift = frame === 1 ? -3 : frame === 2 ? -1 : 0;

		this.drawSprite(
			pose.x,
			pose.y + Math.round((headStart / this.image.height) * pose.height),
			pose.width,
			Math.ceil(((this.image.height - headStart) / this.image.height) * pose.height),
			0,
			headStart,
			this.image.width,
			this.image.height - headStart,
		);
		this.drawSprite(
			pose.x,
			pose.y + headLift,
			pose.width,
			Math.ceil((headStart / this.image.height) * pose.height),
			0,
			0,
			this.image.width,
			headStart,
		);
	}

	private getPose(): { x: number; y: number; width: number; height: number } {
		const width = this.image.naturalWidth || this.image.width;
		const height = this.image.naturalHeight || this.image.height;
		const scale = Math.min(1, (CANVAS_SIZE - 6) / Math.max(width, height));
		const frameWidth = Math.max(1, Math.round(width * scale));
		const frameHeight = Math.max(1, Math.round(height * scale));
		return {
			x: Math.round((CANVAS_SIZE - frameWidth) / 2),
			y: Math.round(CANVAS_SIZE - frameHeight),
			width: frameWidth,
			height: frameHeight,
		};
	}

	private drawSprite(
		dx: number,
		dy: number,
		dw: number,
		dh: number,
		sx = 0,
		sy = 0,
		sw = this.image.width,
		sh = this.image.height,
	): void {
		this.context.imageSmoothingEnabled = false;
		this.context.drawImage(this.image, sx, sy, sw, sh, dx, dy, dw, dh);
	}
}
