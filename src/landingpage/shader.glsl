vec2 Translate(vec2 p, vec2 v) {
    return p - v;
}

float sdSphere(vec2 p, float size) {
    return length(p) - size;
}

float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

float ndot(vec2 a, vec2 b ) { return a.x*b.x - a.y*b.y; }
float sdRhombus( in vec2 p, in vec2 b ) 
{
    p = abs(p);
    float h = clamp( ndot(b-2.0*p,b)/dot(b,b), -1.0, 1.0 );
    float d = length( p-0.5*b*vec2(1.0-h,1.0+h) );
    return d * sign( p.x*b.y + p.y*b.x - b.x*b.y );
}

void mainImage( out vec4 fragColor, in vec2 p )
{

    // mask params
    vec2 center = iResolution.xy / 2.0;
    vec2 maskCenter = center;
    float maskMaxSize = iResolution.x / 1.7;
    float timeScale = 1.0;
    float maskSize = (sin(iTime * timeScale) + 1.0) * maskMaxSize;

    // calculate center
    float voxelSize = 20.0;
    vec2 scaledP = p / voxelSize;
    vec2 voxelCoord = (floor(scaledP) + vec2(0.5)) * voxelSize;
    vec2 pRelaviteToVoxel = p - voxelCoord;
    
    // calculate mask factor at the voxel center
    maskCenter = Translate(voxelCoord, maskCenter);
    float maskFactor = sdRhombus(maskCenter, vec2(maskSize, maskSize)) / 250.0;
    
    float voxelScale = - maskFactor * voxelSize / 2.0;
    float c = sdBox(pRelaviteToVoxel, vec2(voxelScale));
    c = clamp(c,0.0, 1.0);
    
    //colors
    vec3 colorA = vec3(255, 143, 177) / 255.0;
    vec3 colorB = vec3(67, 44, 122) / 255.0;
    vec3 color = mix(colorA, colorB, c);
    

    // Output to screen
    fragColor = vec4(color,1.0);
}