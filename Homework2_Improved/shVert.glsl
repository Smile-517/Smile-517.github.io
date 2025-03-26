#version 300 es

layout (location = 0) in vec3 aPos;

uniform float locX;
uniform float locY;

void main() {
    gl_Position = vec4(locX + aPos[0], locY + aPos[1], aPos[2], 1.0);
}