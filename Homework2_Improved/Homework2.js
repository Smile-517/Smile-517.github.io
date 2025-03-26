import { resizeAspectRatio, setupText } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;   // shader program
let vao;      // vertex array object
let locX = 0.0;
let locY = 0.0;
let arrowUp = false;
let arrowDown = false;
let arrowLeft = false;
let arrowRight = false;

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 600;
    canvas.height = 600;

    resizeAspectRatio(gl, canvas);

    // Initialize WebGL settings
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    return true;
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function setupKeyboardEvents() {

    window.addEventListener('keydown', (event) => {
        // 아래 if condition을 if (event.key in keys)로 간단히 할 수도 있음
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown' ||
            event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            if (event.key === 'ArrowUp') {
                arrowUp = true;
            }
            else if (event.key === 'ArrowDown') {
                arrowDown = true;
            }
            else if (event.key === 'ArrowLeft') {
                arrowLeft = true;
            }
            else if (event.key === 'ArrowRight') {
                arrowRight = true;
            }
        }
    });

    window.addEventListener('keyup', (event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown' ||
            event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            if (event.key === 'ArrowUp') {
                arrowUp = false;
            } else if (event.key === 'ArrowDown') {
                arrowDown = false;
            } else if (event.key === 'ArrowLeft') {
                arrowLeft = false;
            } else if (event.key === 'ArrowRight') {
                arrowRight = false;
            }
        }
    });
}

function setupBuffers() {
    const vertices = new Float32Array([
        -0.1, -0.1, 0.0,  // Bottom left
         0.1, -0.1, 0.0,  // Bottom right
         0.1, 0.1, 0.0,   // Top right
        -0.1, 0.1, 0.0    // Top left
    ]);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    shader.setAttribPointer('aPos', 3, gl.FLOAT, false, 0, 0);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (arrowUp && locY <= 0.9) {
        locY += 0.01;
    } else if (arrowDown && locY >= -0.9) {
        locY -= 0.01;
    } else if (arrowLeft && locX >= -0.9) {
        locX -= 0.01;
    } else if (arrowRight && locX <= 0.9) {
        locX += 0.01;
    }

    shader.setFloat("locX", locX);
    shader.setFloat("locY", locY);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    requestAnimationFrame(() => render());
}

async function main() {
    try {

        // WebGL 초기화
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
        }

        // 셰이더 초기화
        await initShader();

        // setup text overlay (see util.js)
        setupText(canvas, "Use arrow keys to move the rectangle", 1);

        // 키보드 이벤트 설정
        setupKeyboardEvents();

        // 나머지 초기화
        setupBuffers(shader);
        shader.use();

        // 렌더링 시작
        render();

        return true;

    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}

// call main function
main().then(success => {
    if (!success) {
        console.log('프로그램을 종료합니다.');
        return;
    }
}).catch(error => {
    console.error('프로그램 실행 중 오류 발생:', error);
});
