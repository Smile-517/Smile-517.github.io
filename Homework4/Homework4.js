import { resizeAspectRatio, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

let isInitialized = false;
let shader;
let vao;
let axes;
let sunTransform;
let earthTransform;
let moonTransform;
let deltaTime = 0;
let lastTime = 0;  // 이전의 frame의 시간

let sunRotationAngle = 0;
let earthRotationAngle = 0;
let earthRevolutionAngle = 0;
let moonRotationAngle = 0;
let moonRevolutionAngle = 0;

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
        requestAnimationFrame(animate);
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.2, 0.3, 0.4, 1.0);

    return true;
}

function setupBuffers() {
    const cubeVertices = new Float32Array([
        -0.5,  0.5, 0.0,  // 좌상단
        -0.5, -0.5, 0.0,  // 좌하단
         0.5, -0.5, 0.0,  // 우하단
         0.5,  0.5, 0.0   // 우상단
    ]);

    const indices = new Uint16Array([
        0, 1, 2,    // 첫 번째 삼각형
        0, 2, 3     // 두 번째 삼각형
    ]);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // VBO for position
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);
    shader.setAttribPointer("a_position", 3, gl.FLOAT, false, 0, 0);

    // EBO
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
}

function applyTransform() {
    sunTransform = mat4.create();
    earthTransform = mat4.create();
    moonTransform = mat4.create();

    sunRotationAngle += deltaTime * Math.PI / 4;
    mat4.rotate(sunTransform, sunTransform, sunRotationAngle, [0, 0, 1]);
    mat4.scale(sunTransform, sunTransform, [0.2, 0.2, 1]);

    earthRevolutionAngle += deltaTime * Math.PI / 6;
    mat4.rotate(earthTransform, earthTransform, earthRevolutionAngle, [0, 0, 1]);
    mat4.translate(earthTransform, earthTransform, [0.7, 0, 0]);
    earthRotationAngle += deltaTime * Math.PI;
    mat4.rotate(earthTransform, earthTransform, earthRotationAngle, [0, 0, 1]);
    mat4.scale(earthTransform, earthTransform, [0.1, 0.1, 1]);

    mat4.rotate(moonTransform, moonTransform, earthRevolutionAngle, [0, 0, 1]);
    mat4.translate(moonTransform, moonTransform, [0.7, 0, 0]);
    moonRevolutionAngle += deltaTime * Math.PI * 2;
    mat4.rotate(moonTransform, moonTransform, moonRevolutionAngle, [0, 0, 1]);
    mat4.translate(moonTransform, moonTransform, [0.2, 0, 0]);
    moonRotationAngle += deltaTime * Math.PI;
    mat4.rotate(moonTransform, moonTransform, moonRotationAngle, [0, 0, 1]);
    mat4.scale(moonTransform, moonTransform, [0.05, 0.05, 1]);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    // draw axes, IMPORTANT: this line uses other shader program and vao, so shader.use() and gl.bindVertexArray(vao) should be called again
    axes.draw(mat4.create(), mat4.create());

    shader.use();
    gl.bindVertexArray(vao);

    // draw sun
    shader.setVec4("u_color", 1.0, 0.0, 0.0, 1.0);  // red
    shader.setMat4("u_model", sunTransform);
    // gl.drawElements(mode, index_count, type, byte_offset);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    // draw earth
    shader.setVec4("u_color", 0.0, 1.0, 1.0, 1.0);  // cyan
    shader.setMat4("u_model", earthTransform);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    // draw moon
    shader.setVec4("u_color", 1.0, 1.0, 0.0, 1.0);  // yellow
    shader.setMat4("u_model", moonTransform);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function animate(currentTime) {

    if (!lastTime) lastTime = currentTime; // if lastTime == 0
    // deltaTime: 이전 frame에서부터의 elapsed time (in seconds)
    deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    applyTransform();
    render();

    requestAnimationFrame(animate);
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
        }

        await initShader();

        setupBuffers();

        axes = new Axes(gl, 1.0);

        return true;
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
