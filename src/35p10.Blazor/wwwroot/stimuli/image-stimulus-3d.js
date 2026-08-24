class ImageStimulusViewer3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext("webgl", { antialias: true, alpha: false });
        if (!this.gl) {
            throw new Error("WebGL is not available in this browser.");
        }

        this.imageSrc = null;
        this.texture = null;
        this.hasTexture = false;
        this.maskSrc = null;
        this.maskTexture = null;
        this.hasMask = false;
        this.marker = null;
        this.heatmapPoints = [];
        this.heatmapLevel = 1.6;
        this.orientation = [0, 0, 0, 1];
        this.fov = 75 * Math.PI / 180;
        this.minFov = 35 * Math.PI / 180;
        this.maxFov = 110 * Math.PI / 180;
        this.wheelFovEnabled = true;
        this.isPointerDown = false;
        this.activePointerId = null;
        this.lastPointerX = 0;
        this.lastPointerY = 0;
        this.disposed = false;

        this.program = this.createSphereProgram();
        this.markerProgram = createOverlayMarkerProgram(this.gl);
        this.heatmapProgram = createOverlayHeatmapProgram(this.gl);
        this.buffers = this.createSphereBuffers();
        this.markerBuffer = this.gl.createBuffer();
        this.heatmapBuffer = this.gl.createBuffer();

        this.handlePointerDown = this.onPointerDown.bind(this);
        this.handlePointerMove = this.onPointerMove.bind(this);
        this.handlePointerUp = this.onPointerUp.bind(this);
        this.handleWheel = this.onWheel.bind(this);

        canvas.addEventListener("pointerdown", this.handlePointerDown);
        canvas.addEventListener("pointermove", this.handlePointerMove);
        canvas.addEventListener("pointerup", this.handlePointerUp);
        canvas.addEventListener("pointercancel", this.handlePointerUp);
        canvas.addEventListener("wheel", this.handleWheel, { passive: false });

        this.render = this.render.bind(this);
        this.frameId = requestAnimationFrame(this.render);
    }

    async update(imageSrc, markerU, markerV, heatmapPoints, heatmapLevel, maskSrc) {
        if (imageSrc && imageSrc !== this.imageSrc) {
            this.imageSrc = imageSrc;
            await this.loadTexture(imageSrc);
        }

        const nextMaskSrc = maskSrc || null;
        if (nextMaskSrc !== this.maskSrc) {
            this.maskSrc = nextMaskSrc;
            if (nextMaskSrc) {
                await this.loadMaskTexture(nextMaskSrc);
            } else {
                this.hasMask = false;
            }
        }

        this.heatmapLevel = Number.isFinite(heatmapLevel) ? heatmapLevel : 1.6;
        this.heatmapPoints = buildHeatmapPoints(
            heatmapPoints,
            this.heatmapLevel,
            (u, v, radius) => this.uvToSpherePoint(u, v, radius),
            9.88);

        if (this.heatmapPoints.length === 0 && Number.isFinite(markerU) && Number.isFinite(markerV)) {
            this.marker = this.uvToSpherePoint(markerU, markerV, 9.85);
        } else {
            this.marker = null;
        }
    }

    setFovDegrees(degrees, options = {}) {
        const value = Number(degrees);
        if (!Number.isFinite(value)) {
            return this.getFovDegrees();
        }

        if (options?.wheelFovEnabled === false) {
            this.wheelFovEnabled = false;
        } else if (options?.wheelFovEnabled === true) {
            this.wheelFovEnabled = true;
        }

        const minDeg = Number.isFinite(options?.min) ? options.min : 35;
        const maxDeg = Number.isFinite(options?.max) ? options.max : 110;
        this.minFov = Math.min(minDeg, maxDeg) * Math.PI / 180;
        this.maxFov = Math.max(minDeg, maxDeg) * Math.PI / 180;
        this.fov = Math.max(this.minFov, Math.min(this.maxFov, value * Math.PI / 180));
        return this.getFovDegrees();
    }

    getFovDegrees() {
        return this.fov * 180 / Math.PI;
    }

    dispose() {
        this.disposed = true;
        cancelAnimationFrame(this.frameId);
        this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
        this.canvas.removeEventListener("pointermove", this.handlePointerMove);
        this.canvas.removeEventListener("pointerup", this.handlePointerUp);
        this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
        this.canvas.removeEventListener("wheel", this.handleWheel);
    }

    onPointerDown(event) {
        if (event.button !== 0) {
            return;
        }

        this.isPointerDown = true;
        this.activePointerId = event.pointerId;
        this.lastPointerX = event.clientX;
        this.lastPointerY = event.clientY;
        this.canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    onPointerMove(event) {
        if (!this.isPointerDown || event.pointerId !== this.activePointerId) {
            return;
        }

        const deltaX = event.clientX - this.lastPointerX;
        const deltaY = event.clientY - this.lastPointerY;
        this.lastPointerX = event.clientX;
        this.lastPointerY = event.clientY;

        if (deltaX === 0 && deltaY === 0) {
            return;
        }

        const sensitivity = this.fov / Math.max(this.canvas.clientHeight, 1);
        this.applyDrag(-deltaX * sensitivity, -deltaY * sensitivity);
        event.preventDefault();
    }

    applyDrag(yawDelta, pitchDelta) {
        if (yawDelta !== 0) {
            this.orientation = multiplyQuats(
                axisAngleQuat([0, 1, 0], yawDelta),
                this.orientation
            );
        }

        if (pitchDelta === 0) {
            this.orientation = normalizeQuat(this.orientation);
            return;
        }

        const right = rotateVectorByQuat([1, 0, 0], this.orientation);
        const pitched = multiplyQuats(axisAngleQuat(right, pitchDelta), this.orientation);
        const forward = rotateVectorByQuat([0, 0, -1], pitched);
        const maxForwardY = Math.cos(0.05);

        if (forward[1] <= maxForwardY && forward[1] >= -maxForwardY) {
            this.orientation = normalizeQuat(pitched);
        } else {
            this.orientation = normalizeQuat(this.orientation);
        }
    }

    onPointerUp(event) {
        if (event.pointerId !== this.activePointerId) {
            return;
        }

        this.isPointerDown = false;
        this.activePointerId = null;
        if (this.canvas.hasPointerCapture(event.pointerId)) {
            this.canvas.releasePointerCapture(event.pointerId);
        }
    }

    onWheel(event) {
        if (!this.wheelFovEnabled) {
            return;
        }

        event.preventDefault();
        this.fov += event.deltaY * 0.0015;
        this.fov = Math.max(this.minFov ?? (35 * Math.PI / 180), Math.min(this.maxFov ?? (110 * Math.PI / 180), this.fov));
    }

    async loadTexture(imageSrc) {
        const image = new Image();
        image.decoding = "async";
        image.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("The source image could not be loaded."));
            image.src = imageSrc;
        });

        if (typeof image.decode === "function") {
            try {
                await image.decode();
            } catch {
                // Some browsers reject decode() even when the image is already usable via onload.
            }
        }

        const gl = this.gl;
        if (!this.texture) {
            this.texture = gl.createTexture();
        }

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        this.hasTexture = true;
    }

    async loadMaskTexture(imageSrc) {
        const image = await loadImage(imageSrc);
        const gl = this.gl;
        if (!this.maskTexture) {
            this.maskTexture = gl.createTexture();
        }

        gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        this.hasMask = true;
    }

    render() {
        if (this.disposed) {
            return;
        }

        this.resizeCanvas();

        const gl = this.gl;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.06, 0.06, 0.06, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        if (this.hasTexture) {
            this.drawSphere();
        }

        if (this.heatmapPoints.length > 0) {
            this.drawHeatmap();
        } else if (this.marker) {
            this.drawMarker();
        }

        this.frameId = requestAnimationFrame(this.render);
    }

    drawSphere() {
        const gl = this.gl;
        const { program, buffers } = this;
        gl.useProgram(program.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(program.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.position);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.uv);
        gl.vertexAttribPointer(program.uv, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.uv);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);

        const projection = createPerspectiveMatrix(this.fov, gl.canvas.width / gl.canvas.height, 0.1, 100);
        const view = createViewMatrixFromOrientation(this.orientation);

        gl.uniformMatrix4fv(program.projection, false, projection);
        gl.uniformMatrix4fv(program.view, false, view);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(program.texture, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.hasMask ? this.maskTexture : this.texture);
        gl.uniform1i(program.mask, 1);
        gl.uniform1f(program.maskOpacity, this.hasMask ? 0.6 : 0);

        gl.drawElements(gl.TRIANGLES, buffers.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    drawMarker() {
        drawOverlayMarker(this.gl, this.markerProgram, this.markerBuffer, this.marker, this.fov, this.orientation);
    }

    drawHeatmap() {
        drawOverlayHeatmap(this.gl, this.heatmapProgram, this.heatmapBuffer, this.heatmapPoints, this.fov, this.orientation);
    }

    resizeCanvas() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
    }

    uvToSpherePoint(u, v, radius) {
        // The inside-facing sphere displays the panorama on the mirrored mesh
        // axis. Mirror the marker on that same axis so its semantic image UV
        // lands on the corresponding panorama pixel.
        const theta = (1 - u) * Math.PI * 2;
        const phi = (1 - v) * Math.PI;
        const sinPhi = Math.sin(phi);
        return [
            -radius * sinPhi * Math.cos(theta),
            radius * Math.cos(phi),
            radius * sinPhi * Math.sin(theta)
        ];
    }

    createSphereBuffers() {
        const gl = this.gl;
        const radius = 10;
        const widthSegments = 64;
        const heightSegments = 40;
        const positions = [];
        const uvs = [];
        const indices = [];

        for (let y = 0; y <= heightSegments; y++) {
            const v = y / heightSegments;
            const phi = v * Math.PI;

            for (let x = 0; x <= widthSegments; x++) {
                const u = x / widthSegments;
                const theta = u * Math.PI * 2;
                const sinPhi = Math.sin(phi);

                positions.push(
                    -radius * sinPhi * Math.cos(theta),
                    radius * Math.cos(phi),
                    radius * sinPhi * Math.sin(theta)
                );
                uvs.push(1 - u, v);
            }
        }

        for (let y = 0; y < heightSegments; y++) {
            for (let x = 0; x < widthSegments; x++) {
                const a = y * (widthSegments + 1) + x;
                const b = a + widthSegments + 1;
                indices.push(a, b, a + 1);
                indices.push(b, b + 1, a + 1);
            }
        }

        const position = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, position);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const uv = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uv);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

        const index = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        return { position, uv, index, indexCount: indices.length };
    }

    createSphereProgram() {
        const vertex = `
            attribute vec3 aPosition;
            attribute vec2 aUv;
            uniform mat4 uProjection;
            uniform mat4 uView;
            varying vec2 vUv;
            void main() {
                vUv = aUv;
                gl_Position = uProjection * uView * vec4(aPosition, 1.0);
            }
        `;

        const fragment = `
            precision mediump float;
            uniform sampler2D uTexture;
            uniform sampler2D uMask;
            uniform float uMaskOpacity;
            varying vec2 vUv;
            void main() {
                vec4 base = texture2D(uTexture, vUv);
                vec4 mask = texture2D(uMask, vUv);
                gl_FragColor = mix(base, vec4(mask.rgb, 1.0), uMaskOpacity * mask.a);
            }
        `;

        const program = createProgram(this.gl, vertex, fragment);
        return {
            program,
            position: this.gl.getAttribLocation(program, "aPosition"),
            uv: this.gl.getAttribLocation(program, "aUv"),
            projection: this.gl.getUniformLocation(program, "uProjection"),
            view: this.gl.getUniformLocation(program, "uView"),
            texture: this.gl.getUniformLocation(program, "uTexture"),
            mask: this.gl.getUniformLocation(program, "uMask"),
            maskOpacity: this.gl.getUniformLocation(program, "uMaskOpacity")
        };
    }

}

class CubemapStimulusViewer3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext("webgl", { antialias: true, alpha: false });
        if (!this.gl) {
            throw new Error("WebGL is not available in this browser.");
        }

        this.faceSourcesKey = null;
        this.texture = null;
        this.hasTexture = false;
        this.maskFaceSourcesKey = null;
        this.maskTexture = null;
        this.hasMask = false;
        this.marker = null;
        this.heatmapPoints = [];
        this.heatmapLevel = 1.6;
        // Faces are authored for Unity (+Z forward). WebGL cameras look down -Z,
        // so start yawed 180° to open on the front face.
        this.orientation = axisAngleQuat([0, 1, 0], Math.PI);
        this.fov = 75 * Math.PI / 180;
        this.isPointerDown = false;
        this.activePointerId = null;
        this.lastPointerX = 0;
        this.lastPointerY = 0;
        this.disposed = false;

        this.program = this.createCubemapProgram();
        this.markerProgram = createOverlayMarkerProgram(this.gl);
        this.heatmapProgram = createOverlayHeatmapProgram(this.gl);
        this.buffers = this.createCubeBuffers();
        this.markerBuffer = this.gl.createBuffer();
        this.heatmapBuffer = this.gl.createBuffer();

        this.handlePointerDown = this.onPointerDown.bind(this);
        this.handlePointerMove = this.onPointerMove.bind(this);
        this.handlePointerUp = this.onPointerUp.bind(this);
        this.handleWheel = this.onWheel.bind(this);

        canvas.addEventListener("pointerdown", this.handlePointerDown);
        canvas.addEventListener("pointermove", this.handlePointerMove);
        canvas.addEventListener("pointerup", this.handlePointerUp);
        canvas.addEventListener("pointercancel", this.handlePointerUp);
        canvas.addEventListener("wheel", this.handleWheel, { passive: false });

        this.render = this.render.bind(this);
        this.frameId = requestAnimationFrame(this.render);
    }

    async update(faceSources, markerU, markerV, heatmapPoints, heatmapLevel, maskFaceSources) {
        const sources = normalizeCubemapSources(faceSources);
        const key = JSON.stringify(sources);
        if (key !== this.faceSourcesKey) {
            this.faceSourcesKey = key;
            await this.loadCubemapTexture(sources);
        }

        const maskSources = maskFaceSources ? normalizeCubemapSources(maskFaceSources) : null;
        const maskKey = maskSources ? JSON.stringify(maskSources) : null;
        if (maskKey !== this.maskFaceSourcesKey) {
            this.maskFaceSourcesKey = maskKey;
            if (maskSources) {
                await this.loadCubemapMaskTexture(maskSources);
            } else {
                this.hasMask = false;
            }
        }

        this.heatmapLevel = Number.isFinite(heatmapLevel) ? heatmapLevel : 1.6;
        this.heatmapPoints = buildHeatmapPoints(
            heatmapPoints,
            this.heatmapLevel,
            (u, v, radius) => this.uvToCubePoint(u, v, radius),
            9.88);

        if (this.heatmapPoints.length === 0 && Number.isFinite(markerU) && Number.isFinite(markerV)) {
            this.marker = this.uvToCubePoint(markerU, markerV, 9.85);
        } else {
            this.marker = null;
        }
    }

    // Inverse of the atlas layout in loadCubemapAtlasImages() (front/right/back on row 0,
    // left/up/down on row 1) composed with the standard WebGL cube-map face-selection
    // formulas (the same ones textureCube() uses internally to pick a face from a
    // direction), so a gaze UV lands on the exact texel the shader would render there.
    uvToCubePoint(u, v, radius) {
        const column = Math.min(2, Math.max(0, Math.floor(u * 3)));
        const row = Math.min(1, Math.max(0, Math.floor(v * 2)));
        const faceU = u * 3 - column;
        const faceV = v * 2 - row;
        const su = faceU * 2 - 1;
        const sv = faceV * 2 - 1;
        const faceNames = [["front", "right", "back"], ["left", "up", "down"]];
        const face = faceNames[row][column];

        let direction;
        switch (face) {
            case "front":
                direction = [su, -sv, 1];
                break;
            case "back":
                direction = [-su, -sv, -1];
                break;
            case "right":
                direction = [1, -sv, -su];
                break;
            case "left":
                direction = [-1, -sv, su];
                break;
            case "up":
                direction = [su, 1, sv];
                break;
            default:
                direction = [su, -1, -sv];
                break;
        }

        const length = Math.hypot(direction[0], direction[1], direction[2]) || 1;
        return [
            (direction[0] / length) * radius,
            (direction[1] / length) * radius,
            (direction[2] / length) * radius
        ];
    }

    dispose() {
        this.disposed = true;
        cancelAnimationFrame(this.frameId);
        this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
        this.canvas.removeEventListener("pointermove", this.handlePointerMove);
        this.canvas.removeEventListener("pointerup", this.handlePointerUp);
        this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
        this.canvas.removeEventListener("wheel", this.handleWheel);
    }

    onPointerDown(event) {
        if (event.button !== 0) {
            return;
        }

        this.isPointerDown = true;
        this.activePointerId = event.pointerId;
        this.lastPointerX = event.clientX;
        this.lastPointerY = event.clientY;
        this.canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    onPointerMove(event) {
        if (!this.isPointerDown || event.pointerId !== this.activePointerId) {
            return;
        }

        const deltaX = event.clientX - this.lastPointerX;
        const deltaY = event.clientY - this.lastPointerY;
        this.lastPointerX = event.clientX;
        this.lastPointerY = event.clientY;

        if (deltaX === 0 && deltaY === 0) {
            return;
        }

        const sensitivity = this.fov / Math.max(this.canvas.clientHeight, 1);
        this.applyDrag(-deltaX * sensitivity, -deltaY * sensitivity);
        event.preventDefault();
    }

    applyDrag(yawDelta, pitchDelta) {
        if (yawDelta !== 0) {
            this.orientation = multiplyQuats(
                axisAngleQuat([0, 1, 0], yawDelta),
                this.orientation
            );
        }

        if (pitchDelta === 0) {
            this.orientation = normalizeQuat(this.orientation);
            return;
        }

        const right = rotateVectorByQuat([1, 0, 0], this.orientation);
        const pitched = multiplyQuats(axisAngleQuat(right, pitchDelta), this.orientation);
        const forward = rotateVectorByQuat([0, 0, -1], pitched);
        const maxForwardY = Math.cos(0.05);

        if (forward[1] <= maxForwardY && forward[1] >= -maxForwardY) {
            this.orientation = normalizeQuat(pitched);
        } else {
            this.orientation = normalizeQuat(this.orientation);
        }
    }

    onPointerUp(event) {
        if (event.pointerId !== this.activePointerId) {
            return;
        }

        this.isPointerDown = false;
        this.activePointerId = null;
        if (this.canvas.hasPointerCapture(event.pointerId)) {
            this.canvas.releasePointerCapture(event.pointerId);
        }
    }

    onWheel(event) {
        event.preventDefault();
        this.fov += event.deltaY * 0.0015;
        this.fov = Math.max(35 * Math.PI / 180, Math.min(95 * Math.PI / 180, this.fov));
    }

    async loadCubemapTexture(sources) {
        const images = sources.atlas
            ? await loadCubemapAtlasImages(sources.atlas)
            : await Promise.all([
                loadImage(sources.front),
                loadImage(sources.back),
                loadImage(sources.right),
                loadImage(sources.left),
                loadImage(sources.up),
                loadImage(sources.down)
            ]);

        const gl = this.gl;
        if (!this.texture) {
            this.texture = gl.createTexture();
        }

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

        // Match Unity/exporter axes: +Z front, -Z back, +X right, -X left, +Y up, -Y down.
        const targets = [
            [gl.TEXTURE_CUBE_MAP_POSITIVE_Z, images[0]],
            [gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, images[1]],
            [gl.TEXTURE_CUBE_MAP_POSITIVE_X, images[2]],
            [gl.TEXTURE_CUBE_MAP_NEGATIVE_X, images[3]],
            [gl.TEXTURE_CUBE_MAP_POSITIVE_Y, images[4]],
            [gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, images[5]]
        ];

        for (const [target, image] of targets) {
            gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        }

        this.hasTexture = true;
    }

    async loadCubemapMaskTexture(sources) {
        const images = sources.atlas
            ? await loadCubemapAtlasImages(sources.atlas)
            : await Promise.all([
                loadImage(sources.front),
                loadImage(sources.back),
                loadImage(sources.right),
                loadImage(sources.left),
                loadImage(sources.up),
                loadImage(sources.down)
            ]);

        const gl = this.gl;
        if (!this.maskTexture) {
            this.maskTexture = gl.createTexture();
        }

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.maskTexture);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

        const targets = [
            [gl.TEXTURE_CUBE_MAP_POSITIVE_Z, images[0]],
            [gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, images[1]],
            [gl.TEXTURE_CUBE_MAP_POSITIVE_X, images[2]],
            [gl.TEXTURE_CUBE_MAP_NEGATIVE_X, images[3]],
            [gl.TEXTURE_CUBE_MAP_POSITIVE_Y, images[4]],
            [gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, images[5]]
        ];

        for (const [target, image] of targets) {
            gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        }

        this.hasMask = true;
    }

    render() {
        if (this.disposed) {
            return;
        }

        this.resizeCanvas();
        const gl = this.gl;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.06, 0.06, 0.06, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        if (this.hasTexture) {
            this.drawCubemap();
        }

        if (this.heatmapPoints.length > 0) {
            drawOverlayHeatmap(this.gl, this.heatmapProgram, this.heatmapBuffer, this.heatmapPoints, this.fov, this.orientation);
        } else if (this.marker) {
            drawOverlayMarker(this.gl, this.markerProgram, this.markerBuffer, this.marker, this.fov, this.orientation);
        }

        this.frameId = requestAnimationFrame(this.render);
    }

    drawCubemap() {
        const gl = this.gl;
        const { program, buffers } = this;
        gl.useProgram(program.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(program.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.position);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);

        const projection = createPerspectiveMatrix(this.fov, gl.canvas.width / gl.canvas.height, 0.1, 100);
        const view = createViewMatrixFromOrientation(this.orientation);
        gl.uniformMatrix4fv(program.projection, false, projection);
        gl.uniformMatrix4fv(program.view, false, view);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture);
        gl.uniform1i(program.texture, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.hasMask ? this.maskTexture : this.texture);
        gl.uniform1i(program.mask, 1);
        gl.uniform1f(program.maskOpacity, this.hasMask ? 0.6 : 0);

        gl.drawElements(gl.TRIANGLES, buffers.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    resizeCanvas() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
    }

    createCubeBuffers() {
        const gl = this.gl;
        const s = 10;
        const positions = [
            -s, -s, -s, s, -s, -s, s, s, -s, -s, s, -s,
            -s, -s, s, -s, s, s, s, s, s, s, -s, s,
            -s, s, -s, s, s, -s, s, s, s, -s, s, s,
            -s, -s, -s, -s, -s, s, s, -s, s, s, -s, -s,
            s, -s, -s, s, -s, s, s, s, s, s, s, -s,
            -s, -s, -s, -s, s, -s, -s, s, s, -s, -s, s
        ];
        const indices = [
            0, 1, 2, 0, 2, 3,
            4, 5, 6, 4, 6, 7,
            8, 9, 10, 8, 10, 11,
            12, 13, 14, 12, 14, 15,
            16, 17, 18, 16, 18, 19,
            20, 21, 22, 20, 22, 23
        ];

        const position = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, position);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const index = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        return { position, index, indexCount: indices.length };
    }

    createCubemapProgram() {
        const vertex = `
            attribute vec3 aPosition;
            uniform mat4 uProjection;
            uniform mat4 uView;
            varying vec3 vDirection;
            void main() {
                vDirection = aPosition;
                gl_Position = uProjection * uView * vec4(aPosition, 1.0);
            }
        `;

        const fragment = `
            precision mediump float;
            uniform samplerCube uTexture;
            uniform samplerCube uMask;
            uniform float uMaskOpacity;
            varying vec3 vDirection;
            void main() {
                vec3 dir = normalize(vDirection);
                vec4 base = textureCube(uTexture, dir);
                vec4 mask = textureCube(uMask, dir);
                gl_FragColor = mix(base, vec4(mask.rgb, 1.0), uMaskOpacity * mask.a);
            }
        `;

        const program = createProgram(this.gl, vertex, fragment);
        return {
            program,
            position: this.gl.getAttribLocation(program, "aPosition"),
            projection: this.gl.getUniformLocation(program, "uProjection"),
            view: this.gl.getUniformLocation(program, "uView"),
            texture: this.gl.getUniformLocation(program, "uTexture"),
            mask: this.gl.getUniformLocation(program, "uMask"),
            maskOpacity: this.gl.getUniformLocation(program, "uMaskOpacity")
        };
    }
}

class EcpStimulusViewer3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext("webgl", { antialias: true, alpha: false });
        if (!this.gl) {
            throw new Error("WebGL is not available in this browser.");
        }

        this.imageSrc = null;
        this.texture = null;
        this.hasTexture = false;
        this.maskSrc = null;
        this.maskTexture = null;
        this.hasMask = false;
        this.marker = null;
        this.heatmapPoints = [];
        this.heatmapLevel = 1.6;
        this.equatorialSinLatitudeLimit = 2 / 3;
        // Match Unity/+Z front convention used by the Street View exporters.
        this.orientation = axisAngleQuat([0, 1, 0], Math.PI);
        this.fov = 75 * Math.PI / 180;
        this.isPointerDown = false;
        this.activePointerId = null;
        this.lastPointerX = 0;
        this.lastPointerY = 0;
        this.disposed = false;

        this.program = this.createEcpProgram();
        this.markerProgram = createOverlayMarkerProgram(this.gl);
        this.heatmapProgram = createOverlayHeatmapProgram(this.gl);
        this.buffers = this.createCubeBuffers();
        this.markerBuffer = this.gl.createBuffer();
        this.heatmapBuffer = this.gl.createBuffer();

        this.handlePointerDown = this.onPointerDown.bind(this);
        this.handlePointerMove = this.onPointerMove.bind(this);
        this.handlePointerUp = this.onPointerUp.bind(this);
        this.handleWheel = this.onWheel.bind(this);

        canvas.addEventListener("pointerdown", this.handlePointerDown);
        canvas.addEventListener("pointermove", this.handlePointerMove);
        canvas.addEventListener("pointerup", this.handlePointerUp);
        canvas.addEventListener("pointercancel", this.handlePointerUp);
        canvas.addEventListener("wheel", this.handleWheel, { passive: false });

        this.render = this.render.bind(this);
        this.frameId = requestAnimationFrame(this.render);
    }

    async update(imageSrc, equatorialSinLatitudeLimit, markerU, markerV, heatmapPoints, heatmapLevel, maskSrc) {
        if (Number.isFinite(equatorialSinLatitudeLimit) && equatorialSinLatitudeLimit > 0 && equatorialSinLatitudeLimit < 1) {
            this.equatorialSinLatitudeLimit = equatorialSinLatitudeLimit;
        }

        if (imageSrc && imageSrc !== this.imageSrc) {
            this.imageSrc = imageSrc;
            await this.loadTexture(imageSrc);
        }

        const nextMaskSrc = maskSrc || null;
        if (nextMaskSrc !== this.maskSrc) {
            this.maskSrc = nextMaskSrc;
            if (nextMaskSrc) {
                await this.loadMaskTexture(nextMaskSrc);
            } else {
                this.hasMask = false;
            }
        }

        this.heatmapLevel = Number.isFinite(heatmapLevel) ? heatmapLevel : 1.6;
        this.heatmapPoints = buildHeatmapPoints(
            heatmapPoints,
            this.heatmapLevel,
            (u, v, radius) => this.uvToEcpPoint(u, v, radius),
            9.88);

        if (this.heatmapPoints.length === 0 && Number.isFinite(markerU) && Number.isFinite(markerV)) {
            this.marker = this.uvToEcpPoint(markerU, markerV, 9.85);
        } else {
            this.marker = null;
        }
    }

    // Exact algebraic inverse of createEcpProgram()'s fragment shader (dir -> uv), so a
    // gaze UV lands on the same 3D direction the shader would have sampled it from.
    uvToEcpPoint(u, v, radius) {
        const limit = Math.min(0.95, Math.max(0.05, this.equatorialSinLatitudeLimit));
        const column = Math.min(2, Math.max(0, Math.floor(u * 3)));
        const row = Math.min(1, Math.max(0, Math.floor(v * 2)));
        const localU = u * 3 - column;
        const localV = v * 2 - row;

        let longitude;
        let sinLatitude;

        if (row === 0 || column === 1) {
            // Equatorial band: quadrants 0/1/2 sit on row 0, quadrant 3 is packed into
            // the middle cell of row 1 (see cellUv(1,1,...) in the shader).
            const face = row === 0 ? column : 3;
            longitude = ((face + localU) / 4) * 2 * Math.PI - Math.PI;
            sinLatitude = limit * (1 - 2 * localV);
        } else {
            // Polar discs: column 0 = north pole, column 2 = south pole.
            const isNorth = column === 0;
            const x = localU * 2 - 1;
            const y = localV * 2 - 1;
            const ax = Math.abs(x);
            const ay = Math.abs(y);
            const discRadius = Math.max(ax, ay);

            let angle = 0;
            if (discRadius > 1e-6) {
                if (ax >= ay) {
                    angle = x >= 0
                        ? (y / discRadius) * (Math.PI / 4)
                        : wrapAngle(Math.PI - (y / discRadius) * (Math.PI / 4));
                } else {
                    angle = y >= 0
                        ? Math.PI / 2 - (x / discRadius) * (Math.PI / 4)
                        : -Math.PI / 2 + (x / discRadius) * (Math.PI / 4);
                }
            }

            const poleBlend = discRadius * discRadius * (1 - limit);
            sinLatitude = isNorth ? 1 - poleBlend : poleBlend - 1;
            longitude = angle;
        }

        sinLatitude = Math.max(-1, Math.min(1, sinLatitude));
        const cosLatitude = Math.sqrt(Math.max(0, 1 - sinLatitude * sinLatitude));
        const direction = [
            cosLatitude * Math.sin(longitude),
            sinLatitude,
            -cosLatitude * Math.cos(longitude)
        ];

        return [direction[0] * radius, direction[1] * radius, direction[2] * radius];
    }

    dispose() {
        this.disposed = true;
        cancelAnimationFrame(this.frameId);
        this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
        this.canvas.removeEventListener("pointermove", this.handlePointerMove);
        this.canvas.removeEventListener("pointerup", this.handlePointerUp);
        this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
        this.canvas.removeEventListener("wheel", this.handleWheel);
    }

    onPointerDown(event) {
        if (event.button !== 0) {
            return;
        }

        this.isPointerDown = true;
        this.activePointerId = event.pointerId;
        this.lastPointerX = event.clientX;
        this.lastPointerY = event.clientY;
        this.canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    onPointerMove(event) {
        if (!this.isPointerDown || event.pointerId !== this.activePointerId) {
            return;
        }

        const deltaX = event.clientX - this.lastPointerX;
        const deltaY = event.clientY - this.lastPointerY;
        this.lastPointerX = event.clientX;
        this.lastPointerY = event.clientY;

        if (deltaX === 0 && deltaY === 0) {
            return;
        }

        const sensitivity = this.fov / Math.max(this.canvas.clientHeight, 1);
        this.applyDrag(-deltaX * sensitivity, -deltaY * sensitivity);
        event.preventDefault();
    }

    applyDrag(yawDelta, pitchDelta) {
        if (yawDelta !== 0) {
            this.orientation = multiplyQuats(
                axisAngleQuat([0, 1, 0], yawDelta),
                this.orientation
            );
        }

        if (pitchDelta === 0) {
            this.orientation = normalizeQuat(this.orientation);
            return;
        }

        const right = rotateVectorByQuat([1, 0, 0], this.orientation);
        const pitched = multiplyQuats(axisAngleQuat(right, pitchDelta), this.orientation);
        const forward = rotateVectorByQuat([0, 0, -1], pitched);
        const maxForwardY = Math.cos(0.05);

        if (forward[1] <= maxForwardY && forward[1] >= -maxForwardY) {
            this.orientation = normalizeQuat(pitched);
        } else {
            this.orientation = normalizeQuat(this.orientation);
        }
    }

    onPointerUp(event) {
        if (event.pointerId !== this.activePointerId) {
            return;
        }

        this.isPointerDown = false;
        this.activePointerId = null;
        if (this.canvas.hasPointerCapture(event.pointerId)) {
            this.canvas.releasePointerCapture(event.pointerId);
        }
    }

    onWheel(event) {
        event.preventDefault();
        this.fov += event.deltaY * 0.0015;
        this.fov = Math.max(35 * Math.PI / 180, Math.min(95 * Math.PI / 180, this.fov));
    }

    async loadTexture(imageSrc) {
        const image = await loadImage(imageSrc);
        const gl = this.gl;
        if (!this.texture) {
            this.texture = gl.createTexture();
        }

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        this.hasTexture = true;
    }

    async loadMaskTexture(imageSrc) {
        const image = await loadImage(imageSrc);
        const gl = this.gl;
        if (!this.maskTexture) {
            this.maskTexture = gl.createTexture();
        }

        gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        this.hasMask = true;
    }

    render() {
        if (this.disposed) {
            return;
        }

        this.resizeCanvas();
        const gl = this.gl;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.06, 0.06, 0.06, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        if (this.hasTexture) {
            this.drawEcp();
        }

        if (this.heatmapPoints.length > 0) {
            drawOverlayHeatmap(this.gl, this.heatmapProgram, this.heatmapBuffer, this.heatmapPoints, this.fov, this.orientation);
        } else if (this.marker) {
            drawOverlayMarker(this.gl, this.markerProgram, this.markerBuffer, this.marker, this.fov, this.orientation);
        }

        this.frameId = requestAnimationFrame(this.render);
    }

    drawEcp() {
        const gl = this.gl;
        const { program, buffers } = this;
        gl.useProgram(program.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(program.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.position);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);

        const projection = createPerspectiveMatrix(this.fov, gl.canvas.width / gl.canvas.height, 0.1, 100);
        const view = createViewMatrixFromOrientation(this.orientation);
        gl.uniformMatrix4fv(program.projection, false, projection);
        gl.uniformMatrix4fv(program.view, false, view);
        gl.uniform1f(program.equatorialLimit, this.equatorialSinLatitudeLimit);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(program.texture, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.hasMask ? this.maskTexture : this.texture);
        gl.uniform1i(program.mask, 1);
        gl.uniform1f(program.maskOpacity, this.hasMask ? 0.6 : 0);

        gl.drawElements(gl.TRIANGLES, buffers.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    resizeCanvas() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
    }

    createCubeBuffers() {
        const gl = this.gl;
        const s = 10;
        const positions = [
            -s, -s, -s, s, -s, -s, s, s, -s, -s, s, -s,
            -s, -s, s, -s, s, s, s, s, s, s, -s, s,
            -s, s, -s, s, s, -s, s, s, s, -s, s, s,
            -s, -s, -s, -s, -s, s, s, -s, s, s, -s, -s,
            s, -s, -s, s, -s, s, s, s, s, s, s, -s,
            -s, -s, -s, -s, s, -s, -s, s, s, -s, -s, s
        ];
        const indices = [
            0, 1, 2, 0, 2, 3,
            4, 5, 6, 4, 6, 7,
            8, 9, 10, 8, 10, 11,
            12, 13, 14, 12, 14, 15,
            16, 17, 18, 16, 18, 19,
            20, 21, 22, 20, 22, 23
        ];

        const position = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, position);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const index = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        return { position, index, indexCount: indices.length };
    }

    createEcpProgram() {
        const vertex = `
            attribute vec3 aPosition;
            uniform mat4 uProjection;
            uniform mat4 uView;
            varying vec3 vDirection;
            void main() {
                vDirection = aPosition;
                gl_Position = uProjection * uView * vec4(aPosition, 1.0);
            }
        `;

        // Samples the 3x2 packed ECP atlas produced by StreetViewEcpExporter.
        const fragment = `
            precision mediump float;
            uniform sampler2D uTexture;
            uniform sampler2D uMask;
            uniform float uMaskOpacity;
            uniform float uEquatorialLimit;
            varying vec3 vDirection;

            const float PI = 3.14159265359;
            const float PI_2 = 1.57079632679;
            const float PI_4 = 0.78539816339;

            float wrapLongitude(float angle) {
                float wrapped = mod(angle + PI, 2.0 * PI);
                if (wrapped < 0.0) {
                    wrapped += 2.0 * PI;
                }
                return wrapped - PI;
            }

            vec2 discToSquare(float radius, float angle) {
                float a = wrapLongitude(angle);
                if (a >= -PI_4 && a <= PI_4) {
                    return vec2(radius, (a / PI_4) * radius);
                }
                if (a > PI_4 && a < 3.0 * PI_4) {
                    return vec2(((PI_2 - a) / PI_4) * radius, radius);
                }
                if (a >= 3.0 * PI_4 || a <= -3.0 * PI_4) {
                    float aPos = a > 0.0 ? a : a + 2.0 * PI;
                    return vec2(-radius, -((aPos - PI) / PI_4) * radius);
                }
                float raw = a + 2.0 * PI;
                return vec2(-((1.5 * PI - raw) / PI_4) * radius, -radius);
            }

            vec2 cellUv(float column, float row, vec2 localUv) {
                return vec2((column + localUv.x) / 3.0, (row + localUv.y) / 2.0);
            }

            void main() {
                vec3 dir = normalize(vDirection);
                float longitude = atan(dir.x, -dir.z);
                float sinLatitude = clamp(dir.y, -1.0, 1.0);
                float limit = clamp(uEquatorialLimit, 0.05, 0.95);
                vec2 uv;

                if (abs(sinLatitude) <= limit) {
                    float lon01 = (longitude + PI) / (2.0 * PI);
                    float faceF = clamp(lon01 * 4.0, 0.0, 3.999);
                    float face = floor(faceF);
                    float uLocal = faceF - face;
                    float vLocal = (1.0 - (sinLatitude / limit)) * 0.5;

                    if (face < 3.0) {
                        uv = cellUv(face, 0.0, vec2(uLocal, vLocal));
                    } else {
                        uv = cellUv(1.0, 1.0, vec2(uLocal, vLocal));
                    }
                } else {
                    float poleBlend = sinLatitude > 0.0
                        ? (1.0 - sinLatitude)
                        : (1.0 + sinLatitude);
                    float radius = sqrt(clamp(poleBlend / max(1.0 - limit, 0.0001), 0.0, 1.0));
                    vec2 square = discToSquare(radius, longitude);
                    vec2 localUv = square * 0.5 + 0.5;
                    if (sinLatitude > 0.0) {
                        uv = cellUv(0.0, 1.0, localUv);
                    } else {
                        uv = cellUv(2.0, 1.0, localUv);
                    }
                }

                vec2 clampedUv = clamp(uv, 0.0, 1.0);
                vec4 base = texture2D(uTexture, clampedUv);
                vec4 mask = texture2D(uMask, clampedUv);
                gl_FragColor = mix(base, vec4(mask.rgb, 1.0), uMaskOpacity * mask.a);
            }
        `;

        const program = createProgram(this.gl, vertex, fragment);
        return {
            program,
            position: this.gl.getAttribLocation(program, "aPosition"),
            projection: this.gl.getUniformLocation(program, "uProjection"),
            view: this.gl.getUniformLocation(program, "uView"),
            texture: this.gl.getUniformLocation(program, "uTexture"),
            mask: this.gl.getUniformLocation(program, "uMask"),
            maskOpacity: this.gl.getUniformLocation(program, "uMaskOpacity"),
            equatorialLimit: this.gl.getUniformLocation(program, "uEquatorialLimit")
        };
    }
}

async function loadImage(src) {
    if (!src) {
        throw new Error("Cubemap face source is required.");
    }

    const image = new Image();
    image.decoding = "async";
    image.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("The source image could not be loaded."));
        image.src = src;
    });

    if (typeof image.decode === "function") {
        try {
            await image.decode();
        } catch {
        }
    }

    return image;
}

function normalizeCubemapSources(faceSources) {
    return {
        atlas: faceSources?.atlas || "",
        front: faceSources?.front || "",
        right: faceSources?.right || "",
        back: faceSources?.back || "",
        left: faceSources?.left || "",
        up: faceSources?.up || "",
        down: faceSources?.down || ""
    };
}

async function loadCubemapAtlasImages(atlasSource) {
    const atlas = await loadImage(atlasSource);
    const faceSize = Math.floor(Math.min(atlas.naturalWidth / 3, atlas.naturalHeight / 2));
    if (!Number.isFinite(faceSize) || faceSize <= 0) {
        throw new Error("Invalid cubemap atlas size.");
    }

    const layout = {
        front: [0, 0],
        right: [1, 0],
        back: [2, 0],
        left: [0, 1],
        up: [1, 1],
        down: [2, 1]
    };

    const extract = (name) => {
        const [column, row] = layout[name];
        const canvas = document.createElement("canvas");
        canvas.width = faceSize;
        canvas.height = faceSize;
        const context = canvas.getContext("2d");
        context.drawImage(
            atlas,
            column * faceSize,
            row * faceSize,
            faceSize,
            faceSize,
            0,
            0,
            faceSize,
            faceSize);
        return canvas;
    };

    return [
        extract("front"),
        extract("back"),
        extract("right"),
        extract("left"),
        extract("up"),
        extract("down")
    ];
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || "Shader compile error.");
    }
    return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Program link error.");
    }
    return program;
}

// Shared by every viewer class below: a small colored point (marker) or point-cloud
// (heatmap) drawn at given 3D world positions, using the same projection/view as the
// main render. Geometry-agnostic — each viewer only needs to turn its own gaze UV into
// a 3D point on its own surface (uvToSpherePoint / uvToCubePoint / uvToEcpPoint) and
// pass it in here.
function createOverlayMarkerProgram(gl) {
    const vertex = `
        attribute vec3 aPosition;
        uniform mat4 uProjection;
        uniform mat4 uView;
        void main() {
            gl_Position = uProjection * uView * vec4(aPosition, 1.0);
            gl_PointSize = 22.0;
        }
    `;

    const fragment = `
        precision mediump float;
        uniform vec4 uColor;
        void main() {
            vec2 c = gl_PointCoord - vec2(0.5);
            float radius = length(c);
            if (radius > 0.5) discard;
            gl_FragColor = radius > 0.37
                ? vec4(1.0, 1.0, 1.0, 0.65)
                : uColor;
        }
    `;

    const program = createProgram(gl, vertex, fragment);
    return {
        program,
        position: gl.getAttribLocation(program, "aPosition"),
        projection: gl.getUniformLocation(program, "uProjection"),
        view: gl.getUniformLocation(program, "uView"),
        color: gl.getUniformLocation(program, "uColor")
    };
}

function createOverlayHeatmapProgram(gl) {
    const vertex = `
        attribute vec3 aPosition;
        attribute float aSize;
        attribute vec4 aColor;
        uniform mat4 uProjection;
        uniform mat4 uView;
        varying vec4 vColor;
        void main() {
            vColor = aColor;
            gl_Position = uProjection * uView * vec4(aPosition, 1.0);
            gl_PointSize = aSize;
        }
    `;

    const fragment = `
        precision mediump float;
        varying vec4 vColor;
        void main() {
            vec2 c = gl_PointCoord - vec2(0.5);
            float dist = length(c);
            if (dist > 0.5) discard;
            float falloff = 1.0 - smoothstep(0.0, 0.5, dist);
            gl_FragColor = vec4(vColor.rgb, vColor.a * falloff * falloff);
        }
    `;

    const program = createProgram(gl, vertex, fragment);
    return {
        program,
        position: gl.getAttribLocation(program, "aPosition"),
        size: gl.getAttribLocation(program, "aSize"),
        color: gl.getAttribLocation(program, "aColor"),
        projection: gl.getUniformLocation(program, "uProjection"),
        view: gl.getUniformLocation(program, "uView")
    };
}

function drawOverlayMarker(gl, markerProgram, buffer, marker, fov, orientation) {
    gl.useProgram(markerProgram.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(marker), gl.STREAM_DRAW);
    gl.vertexAttribPointer(markerProgram.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(markerProgram.position);

    const projection = createPerspectiveMatrix(fov, gl.canvas.width / gl.canvas.height, 0.1, 100);
    const view = createViewMatrixFromOrientation(orientation);

    gl.uniformMatrix4fv(markerProgram.projection, false, projection);
    gl.uniformMatrix4fv(markerProgram.view, false, view);
    // Match the orange 2D marker (#f59e0b).
    gl.uniform4f(markerProgram.color, 0.961, 0.62, 0.043, 1);

    gl.drawArrays(gl.POINTS, 0, 1);
}

function drawOverlayHeatmap(gl, heatmapProgram, buffer, heatmapPoints, fov, orientation) {
    const strideFloats = 8;
    const data = new Float32Array(heatmapPoints.length * strideFloats);

    for (let index = 0; index < heatmapPoints.length; index++) {
        const point = heatmapPoints[index];
        const offset = index * strideFloats;
        const intensity = point.intensity;
        const t = Math.max(0, Math.min(1, intensity / 3));
        data[offset] = point.position[0];
        data[offset + 1] = point.position[1];
        data[offset + 2] = point.position[2];
        data[offset + 3] = 10 + intensity * 18;
        data[offset + 4] = 1;
        data[offset + 5] = 0.12 + (1 - t) * 0.55;
        data[offset + 6] = (1 - t) * 0.26;
        data[offset + 7] = Math.max(0.22, Math.min(0.95, 0.28 + intensity * 0.28));
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(heatmapProgram.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);

    const strideBytes = strideFloats * 4;
    gl.vertexAttribPointer(heatmapProgram.position, 3, gl.FLOAT, false, strideBytes, 0);
    gl.enableVertexAttribArray(heatmapProgram.position);
    gl.vertexAttribPointer(heatmapProgram.size, 1, gl.FLOAT, false, strideBytes, 12);
    gl.enableVertexAttribArray(heatmapProgram.size);
    gl.vertexAttribPointer(heatmapProgram.color, 4, gl.FLOAT, false, strideBytes, 16);
    gl.enableVertexAttribArray(heatmapProgram.color);

    const projection = createPerspectiveMatrix(fov, gl.canvas.width / gl.canvas.height, 0.1, 100);
    const view = createViewMatrixFromOrientation(orientation);
    gl.uniformMatrix4fv(heatmapProgram.projection, false, projection);
    gl.uniformMatrix4fv(heatmapProgram.view, false, view);

    gl.drawArrays(gl.POINTS, 0, heatmapPoints.length);

    gl.disableVertexAttribArray(heatmapProgram.size);
    gl.disableVertexAttribArray(heatmapProgram.color);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
}

function buildHeatmapPoints(heatmapPoints, heatmapLevel, uvToPoint, radius) {
    const points = Array.isArray(heatmapPoints) ? heatmapPoints : [];
    return points
        .filter((point) => Number.isFinite(point?.u) && Number.isFinite(point?.v))
        .map((point) => {
            const intensity = Math.max(0, Math.min(3, (Number(point.intensity) || 0) * heatmapLevel));
            return { position: uvToPoint(point.u, point.v, radius), intensity };
        });
}

// Inverse of the fragment shader's wrapLongitude(): brings any angle into (-PI, PI].
function wrapAngle(angle) {
    let wrapped = (angle + Math.PI) % (2 * Math.PI);
    if (wrapped < 0) {
        wrapped += 2 * Math.PI;
    }

    return wrapped - Math.PI;
}

function createViewMatrixFromOrientation(orientation) {
    return quatToMatrix(conjugateQuat(orientation));
}

function normalizeQuat(quat) {
    const length = Math.hypot(quat[0], quat[1], quat[2], quat[3]) || 1;
    return [quat[0] / length, quat[1] / length, quat[2] / length, quat[3] / length];
}

function conjugateQuat(quat) {
    return [-quat[0], -quat[1], -quat[2], quat[3]];
}

function multiplyQuats(a, b) {
    const [ax, ay, az, aw] = a;
    const [bx, by, bz, bw] = b;
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz
    ];
}

function axisAngleQuat(axis, angle) {
    if (Math.abs(angle) < 1e-8) {
        return [0, 0, 0, 1];
    }

    const half = angle * 0.5;
    const sinHalf = Math.sin(half);
    const length = Math.hypot(axis[0], axis[1], axis[2]) || 1;
    return [
        (axis[0] / length) * sinHalf,
        (axis[1] / length) * sinHalf,
        (axis[2] / length) * sinHalf,
        Math.cos(half)
    ];
}

function rotateVectorByQuat(vector, quat) {
    const [x, y, z] = vector;
    const [qx, qy, qz, qw] = quat;
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    return [
        ix * qw + iw * -qx + iy * -qz - iz * -qy,
        iy * qw + iw * -qy + iz * -qx - ix * -qz,
        iz * qw + iw * -qz + ix * -qy - iy * -qx
    ];
}

function quatToMatrix(quat) {
    const [x, y, z, w] = quat;
    const x2 = x + x;
    const y2 = y + y;
    const z2 = z + z;
    const xx = x * x2;
    const xy = x * y2;
    const xz = x * z2;
    const yy = y * y2;
    const yz = y * z2;
    const zz = z * z2;
    const wx = w * x2;
    const wy = w * y2;
    const wz = w * z2;
    return new Float32Array([
        1 - (yy + zz), xy + wz, xz - wy, 0,
        xy - wz, 1 - (xx + zz), yz + wx, 0,
        xz + wy, yz - wx, 1 - (xx + yy), 0,
        0, 0, 0, 1
    ]);
}

function createPerspectiveMatrix(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const rangeInv = 1 / (near - far);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (near + far) * rangeInv, -1,
        0, 0, near * far * rangeInv * 2, 0
    ]);
}

export function createImageStimulusViewer(canvas) {
    return new ImageStimulusViewer3D(canvas);
}

export function createCubemapStimulusViewer(canvas) {
    return new CubemapStimulusViewer3D(canvas);
}

export function createEcpStimulusViewer(canvas) {
    return new EcpStimulusViewer3D(canvas);
}
