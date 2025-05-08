#version 300 es

precision highp float;

out vec4 FragColor;
in vec3 fragPos;
in vec3 normal;
// in vec2 texCoord;

uniform int u_toonLevels;

struct Material {
    // sampler2D diffuse;  // diffuse map
    vec3 specular;      // 표면의 specular color
    float shininess;    // specular 반짝임 정도
};

struct Light {
    //vec3 position;
    vec3 direction;
    vec3 ambient;   // ambient 적용 strength
    vec3 diffuse;   // diffuse 적용 strength
    vec3 specular;  // specular 적용 strength
};

uniform Material material;
uniform Light light;
uniform vec3 u_viewPos;

void main() {
    // calculate toon boundarys
    float boundary[5];
    for (int i = 0; i < u_toonLevels; i++) {
        boundary[i] = float(i + 1) / float(u_toonLevels);
    }

    // ambient
    vec3 rgb = vec3(1.0, 0.5, 0.31);
    vec3 ambient = light.ambient * rgb;

    // diffuse
    vec3 norm = normalize(normal);
    // vec3 lightDir = normalize(light.position - fragPos);
    vec3 lightDir = normalize(light.direction);
    float dotNormLight = dot(norm, lightDir);
    float diff = max(dotNormLight, 0.0);

    float diff_t;
    for (int i = 0; i < u_toonLevels; i++) {
        if (diff < boundary[i]) {
            if (i == 0) {
                diff_t = 0.0;
            } else {
                diff_t = boundary[i - 1];
            }
            break;
        }
    }

    vec3 diffuse = light.diffuse * diff_t * rgb;

    // specular
    vec3 viewDir = normalize(u_viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);  // 이 부분에서 들어오는 light 벡터를 -lightDir로 바꿔 줘야 한다.
    float spec = 0.0;
    if (dotNormLight > 0.0) {
        spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    }

    float spec_t;
    for (int i = 0; i < u_toonLevels; i++) {
        if (spec < boundary[i]) {
            if (i == 0) {
                spec_t = 0.0;
            } else {
                spec_t = boundary[i - 1];
            }
            break;
        }
    }

    vec3 specular = light.specular * spec_t * material.specular;

    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
}