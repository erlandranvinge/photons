// GFX Library made to emulate the Processing graphics functionality.
'use strict';

class Gfx {
	constructor(width, height) {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		document.body.appendChild(canvas);
		const context = canvas.getContext('2d');
		context.lineWidth = 1;
		context.translate(0.5, 0.5);
		context.font = '12px Helvetica';
		this.canvas = canvas;
		this.context = context;
		this.images = {};
	}

	grayscale(name, done) {
		let original = this.images[name];
		let canvas = document.createElement('canvas');
		canvas.width = original.width;
		canvas.height = original.height;
		let context = canvas.getContext('2d');
		context.drawImage(original, 0, 0);
		let data = context.getImageData(0, 0, original.width, original.height);
		let pixels = data.data;
		for (let y = 0; y < original.height; y++) {
			for (let x = 0; x < original.width; x++) {
				const i = (y * 4) * original.width + x * 4;
				const avg = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
				pixels[i] = avg;
				pixels[i + 1] = avg;
				pixels[i + 2] = avg;
			}
		}
		context.putImageData(data, 0, 0, 0, 0, original.width, original.height);
		let gray = new Image();
		gray.onload = () => {
			this.images['gray_' + name] = gray;
			done();
		};
		gray.src = canvas.toDataURL();
	}

	loadImages(images, done) {
		let pending = images.length * 2;
		for (let path of images) {
			let image = new Image();
			image.onload = () => {
				this.images[path] = image;
				this.grayscale(path, () => {
					if (!--pending) done();
				});
				if (!--pending) done();
			};
			image.src = path;
		}
	}

	hex(c) {
		return Math.min(Math.max(c|0, 0), 255).toString(16);
	}

	hexify(r, g, b) {
		const rc = this.hex(r);
		const gc = g !== undefined ? this.hex(g) : rc;
		const bc = b !== undefined ? this.hex(b) : rc;
		return '#' + (rc.length === 1 ? '0' + rc : rc) +
			(gc.length === 1 ? '0' + gc : gc) +
			(bc.length === 1 ? '0' + bc : bc);
	}

	stroke(r, g, b) {
		this.context.strokeStyle = this.hexify(r, g, b);
	}

	fill(r, g, b) {
		this.context.fillStyle = this.hexify(r, g, b);
	}

	rect(x, y, w, h) {
		this.context.fillRect(x, y, w, h);
		this.context.strokeRect(x, y, w, h);
	}

	point(x, y) {
		this.context.strokeRect(x, y, .5, .5);
	}

	text(s, x, y) {
		this.context.fillText(s, x, y);
	}

	image(name, x, y) {
		if (!this.images[name]) throw 'invalid image ' + name;
		this.context.drawImage(this.images[name], x, y - 1);
	}


}