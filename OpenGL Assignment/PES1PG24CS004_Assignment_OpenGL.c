/* 
 * CABIN IN THE HILLS - 3D SIMULATION
 * 
 * A complete OpenGL scene featuring:
 * - Dynamic day/night cycle
 * - Weather system (clear, rain, snow, fog)
 * - Animated human characters
 * - Interactive camera controls
 * - Environment with cabin, trees, hills, and clouds
 *
 * Controls:
 *   D - Switch to daytime
 *   N - Switch to nighttime
 *   + - Zoom in
 *   - - Zoom out
 *   W - Cycle through weather modes
 *   Arrow keys - Rotate camera view
 */

// Platform-specific includes
#ifdef __APPLE__
#include <GLUT/glut.h>  // macOS GLUT implementation
#else
#include <GL/glut.h>    // Standard GLUT for other platforms
#endif
#include <math.h>       // Math functions for trigonometry
#include <stdlib.h>     // Standard library for random numbers
#include <time.h>       // Time functions for random seeding

/* GLOBAL VARIABLES */
float sunAngle = 0.0;       // Current solar position in radians
int isDay = 1;              // Day/night toggle (1=day, 0=night)
float cameraAngle = 0.0;     // Camera rotation around Y-axis
float zoom = -30.0;          // Camera distance from scene
int weatherMode = 0;         // Current weather (0-3: clear,rain,snow,fog)
float lightFlicker = 0.8;    // Flicker intensity for night lights
float smokeY = 0.0;          // Vertical position for smoke animation

#define MAX_PEOPLE 5        // Maximum number of characters in scene

/* PERSON STRUCTURE */
typedef struct {
    float x, z;             // 2D position coordinates
    float angle;            // Facing direction in degrees
    float speed;            // Movement speed
    int state;              // 0=standing, 1=walking
    int timer;              // State duration counter
    float legAngle;         // Current leg swing angle
    int legDirection;       // Leg swing direction (1 or -1)
} Person;

Person people[MAX_PEOPLE];  // Array of character instances

/* FUNCTION PROTOTYPES */
void drawCabin();           // Render the cabin structure
void drawTree(float x, float z); // Draw a tree at position
void drawGround();          // Draw the terrain plane
void drawHills();           // Render background hills
void drawCloud(float x, float y, float z); // Draw cloud cluster
void drawPerson(Person* p); // Render a character
void drawSmoke();           // Draw chimney smoke
void drawRainOrSnow();      // Render precipitation
void drawFog();             // Configure fog effects
void initPeople();          // Initialize characters
void updateLighting();      // Update scene lighting
void updatePeople();        // Update character positions
void display();             // Main render function
void keyboard(unsigned char key, int x, int y); // Key press handler
void specialKeys(int key, int x, int y); // Special key handler
void init();                // Initialize OpenGL
void reshape(int w, int h); // Window resize handler
void timer(int value);      // Animation timer

/**
 * Initialize character positions and states with random values
 */
void initPeople() {
    for (int i = 0; i < MAX_PEOPLE; i++) {
        // Random position within scene bounds
        people[i].x = (rand() % 30) - 15;  // X position (-15 to 15)
        people[i].z = (rand() % 30) - 15;  // Z position (-15 to 15)
        people[i].angle = rand() % 360;    // Random initial facing (0-360°)
        people[i].speed = 0.02 + (rand() % 10) * 0.005; // Movement speed
        people[i].state = rand() % 2;      // Random initial state
        people[i].timer = rand() % 100;    // Random state timer
        people[i].legAngle = 0;            // Start with legs straight
        people[i].legDirection = 1;        // Initial leg swing direction
    }
}

/**
 * Configure lighting based on time of day
 * Handles both day and night lighting scenarios
 */
void updateLighting() {
    // Lighting parameters
    GLfloat ambientDay[] = {0.4, 0.4, 0.4, 1.0};    // Full daylight ambient
    GLfloat diffuseDay[] = {1.0, 1.0, 0.8, 1.0};    // Daylight diffuse
    GLfloat ambientNight[] = {lightFlicker, lightFlicker, 0.5, 1.0}; // Flickering night
    GLfloat diffuseNight[] = {0.2, 0.2, 0.4, 1.0};  // Moonlight
    
    // Light source position (follows sun/moon)
    GLfloat position[] = {cos(sunAngle) * 30, sin(sunAngle) * 30, 0.0, 0.0};
    glLightfv(GL_LIGHT0, GL_POSITION, position);
    
    if (isDay) {
        // Daytime configuration
        glClearColor(
            0.5 + 0.3 * cos(sunAngle),  // Dynamic sky color based on sun position
            0.7 + 0.2 * sin(sunAngle), 
            1.0,  // Blue component
            1.0   // Alpha
        );
        glLightfv(GL_LIGHT0, GL_AMBIENT, ambientDay);
        glLightfv(GL_LIGHT0, GL_DIFFUSE, diffuseDay);
    } else {
        // Nighttime configuration
        glClearColor(0.1, 0.1, 0.2, 1.0);  // Dark blue night sky
        glLightfv(GL_LIGHT0, GL_AMBIENT, ambientNight);
        glLightfv(GL_LIGHT0, GL_DIFFUSE, diffuseNight);
    }
}

/**
 * Render precipitation based on current weather mode
 * Draws either rain (blue lines) or snow (white lines)
 */
void drawRainOrSnow() {
    glBegin(GL_LINES);  // Draw precipitation as vertical lines
    
    for (int i = 0; i < 300; i++) {  // 300 particles
        // Random particle position
        float x = (rand() % 100 - 50);  // X position (-50 to 50)
        float y = rand() % 20 + 5;      // Y position (5 to 25)
        float z = (rand() % 100 - 50);  // Z position (-50 to 50)
        
        // Set color based on weather mode
        if (weatherMode == 1) 
            glColor3f(0.5, 0.5, 1.0);  // Blue for rain
        else 
            glColor3f(1.0, 1.0, 1.0);  // White for snow
        
        // Draw particle as vertical line
        glVertex3f(x, y, z);         // Top point
        glVertex3f(x, y - 1.5, z);   // Bottom point
    }
    glEnd();
}

/**
 * Configure and enable fog effects
 * Uses linear fog density for realistic atmospheric perspective
 */
void drawFog() {
    GLfloat fogColor[] = {0.8, 0.8, 0.8, 1.0}; // Gray fog color
    
    glEnable(GL_FOG);
    glFogi(GL_FOG_MODE, GL_LINEAR);       // Linear fog falloff
    glFogfv(GL_FOG_COLOR, fogColor);      // Set fog color
    glFogf(GL_FOG_START, 10.0);           // Fog begins at 10 units
    glFogf(GL_FOG_END, 50.0);             // Full fog at 50 units
}

/**
 * Render smoke effect from cabin chimney
 * Uses animated sphere with transparency
 */
void drawSmoke() {
    glPushMatrix();
    // Position at chimney with vertical animation
    glTranslatef(-1.2, 3.5 + fmod(smokeY, 2.0), -0.8);
    glColor4f(0.8, 0.8, 0.8, 0.5); // Semi-transparent gray
    glutSolidSphere(0.3, 8, 8);     // Smoke puff
    glPopMatrix();
}

/**
 * Render a cabin with detailed construction
 * Includes walls, roof, chimney, door, and windows
 */
void drawCabin() {
    glPushMatrix();

    // Cabin dimensions
    float width = 4.0, height = 2.0, depth = 3.0, roofHeight = 1.5;
    float halfW = width / 2.0, halfD = depth / 2.0;

    /* WALLS - Wooden plank construction */
    glBegin(GL_QUADS);
    for (float y = 0.0; y < height; y += 0.2) {
        // Varying wood color for planks
        glColor3f(0.5 + fmod(y * 2, 0.4), 0.25, 0.1);

        // Front wall
        glVertex3f(-halfW, y, halfD);
        glVertex3f(halfW, y, halfD);
        glVertex3f(halfW, y + 0.2, halfD);
        glVertex3f(-halfW, y + 0.2, halfD);

        // Back wall
        glVertex3f(-halfW, y, -halfD);
        glVertex3f(halfW, y, -halfD);
        glVertex3f(halfW, y + 0.2, -halfD);
        glVertex3f(-halfW, y + 0.2, -halfD);

        // Left wall
        glVertex3f(-halfW, y, -halfD);
        glVertex3f(-halfW, y, halfD);
        glVertex3f(-halfW, y + 0.2, halfD);
        glVertex3f(-halfW, y + 0.2, -halfD);

        // Right wall
        glVertex3f(halfW, y, -halfD);
        glVertex3f(halfW, y, halfD);
        glVertex3f(halfW, y + 0.2, halfD);
        glVertex3f(halfW, y + 0.2, -halfD);
    }
    glEnd();

    /* FLOOR - Wooden planks */
    glColor3f(0.4, 0.2, 0.1); // Darker wood color
    glBegin(GL_QUADS);
    glVertex3f(-halfW, 0.0, -halfD);
    glVertex3f(halfW, 0.0, -halfD);
    glVertex3f(halfW, 0.0, halfD);
    glVertex3f(-halfW, 0.0, halfD);
    glEnd();

    /* DOOR - Centered on front wall */
    glColor3f(0.3, 0.15, 0.05); // Brown door
    glBegin(GL_QUADS);
    glVertex3f(-0.5, 0.0, halfD + 0.01);  // Slightly in front of wall
    glVertex3f(0.5, 0.0, halfD + 0.01);
    glVertex3f(0.5, 1.2, halfD + 0.01);
    glVertex3f(-0.5, 1.2, halfD + 0.01);
    glEnd();

    /* WINDOWS - On front wall */
    glColor3f(0.5, 0.8, 1.0); // Glass blue
    glBegin(GL_QUADS);
    // Left window
    glVertex3f(-1.5, 1.0, halfD + 0.01);
    glVertex3f(-0.9, 1.0, halfD + 0.01);
    glVertex3f(-0.9, 1.5, halfD + 0.01);
    glVertex3f(-1.5, 1.5, halfD + 0.01);
    // Right window
    glVertex3f(1.5, 1.0, halfD + 0.01);
    glVertex3f(0.9, 1.0, halfD + 0.01);
    glVertex3f(0.9, 1.5, halfD + 0.01);
    glVertex3f(1.5, 1.5, halfD + 0.01);
    glEnd();

    /* ROOF - Gabled construction */
    glColor3f(0.4, 0.0, 0.0); // Dark red roof
    // Front triangle
    glBegin(GL_TRIANGLES);
    glVertex3f(-halfW, height, halfD);
    glVertex3f(halfW, height, halfD);
    glVertex3f(0.0, height + roofHeight, halfD);
    // Back triangle
    glVertex3f(-halfW, height, -halfD);
    glVertex3f(halfW, height, -halfD);
    glVertex3f(0.0, height + roofHeight, -halfD);
    glEnd();

    // Roof sides
    glBegin(GL_QUADS);
    // Left side
    glVertex3f(-halfW, height, -halfD);
    glVertex3f(-halfW, height, halfD);
    glVertex3f(0.0, height + roofHeight, halfD);
    glVertex3f(0.0, height + roofHeight, -halfD);
    // Right side
    glVertex3f(halfW, height, -halfD);
    glVertex3f(halfW, height, halfD);
    glVertex3f(0.0, height + roofHeight, halfD);
    glVertex3f(0.0, height + roofHeight, -halfD);
    glEnd();

    /* CHIMNEY - Brick structure */
    glPushMatrix();
    glTranslatef(-1.2, height + 0.5, -0.8); // Position on roof
    glColor3f(0.2, 0.2, 0.2); // Dark gray
    glScalef(0.3, 1.0, 0.3);  // Scale to chimney proportions
    glutSolidCube(1.0);        // Simple cube chimney
    glPopMatrix();

    glPopMatrix();
}

/**
 * Render a tree at specified coordinates
 * @param x X position coordinate
 * @param z Z position coordinate
 */
void drawTree(float x, float z) {
    glPushMatrix();
    glTranslatef(x, 0.0, z); // Position tree
    
    /* TRUNK - Brown cylinder */
    glColor3f(0.4, 0.2, 0.1); // Brown wood
    glPushMatrix();
    glTranslatef(0, 1, 0);    // Raise trunk
    glScalef(0.2, 2, 0.2);    // Scale to trunk shape
    glutSolidCube(1.0);        // Simple cube trunk
    glPopMatrix();

    /* FOLIAGE - Green sphere */
    glColor3f(0.0, 0.6, 0.0); // Green leaves
    glTranslatef(0, 2.5, 0);  // Position foliage above trunk
    glutSolidSphere(0.7, 10, 10); // Spherical foliage
    
    glPopMatrix();
}

/**
 * Render the ground plane
 * Large green quad covering the entire scene
 */
void drawGround() {
    glColor3f(0.3, 0.6, 0.2); // Grass green
    glBegin(GL_QUADS);
    // Cover large area (-50 to 50 in X and Z)
    glVertex3f(-50, 0, -50);
    glVertex3f(-50, 0, 50);
    glVertex3f(50, 0, 50);
    glVertex3f(50, 0, -50);
    glEnd();
}

/**
 * Render two large background hills
 * Uses cones rotated to point upward
 */
void drawHills() {
    glColor3f(0.2, 0.5, 0.2); // Hill green (slightly different from ground)
    
    /* LEFT HILL */
    glPushMatrix();
    glTranslatef(-15, 0, -30); // Position left and back
    glRotatef(-90, 1, 0, 0);   // Rotate cone to point up
    glutSolidCone(15, 10, 30, 30); // Wide base (radius 15), height 10
    glPopMatrix();
    
    /* RIGHT HILL */
    glPushMatrix();
    glTranslatef(15, 0, -30);  // Position right and back
    glRotatef(-90, 1, 0, 0);   // Rotate cone to point up
    glutSolidCone(15, 10, 30, 30); // Same dimensions as left hill
    glPopMatrix();
}

/**
 * Render a cloud cluster at specified position
 * @param x X position coordinate
 * @param y Y position (height) coordinate
 * @param z Z position coordinate
 */
void drawCloud(float x, float y, float z) {
    glColor4f(1.0, 1.0, 1.0, 0.8); // White with transparency
    glPushMatrix();
    glTranslatef(x, y, z); // Position cloud
    
    // Cloud is made of three overlapping spheres
    glutSolidSphere(0.8, 10, 10); // Main cloud mass
    
    glTranslatef(0.8, 0.1, 0.0); // Offset right
    glutSolidSphere(0.6, 10, 10); // Right puff
    
    glTranslatef(-1.6, 0.1, 0.0); // Offset left from original
    glutSolidSphere(0.6, 10, 10); // Left puff
    
    glPopMatrix();
}

/**
 * Main display function - renders entire scene
 * Called whenever the display needs updating
 */
void display() {
    // Clear buffers
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glLoadIdentity();
    
    // Set camera position and orientation
    glTranslatef(0.0, -5.0, zoom);      // Position camera
    glRotatef(cameraAngle, 0.0, 1.0, 0.0); // Rotate view

    // Update lighting based on time
    updateLighting();
    
    // Enable fog if in fog weather mode
    if (weatherMode == 3) drawFog();

    /* DRAW SCENE ELEMENTS */
    drawGround();    // Draw terrain first
    drawHills();     // Background hills
    drawCabin();     // Main cabin structure

    // Draw trees at various positions
    drawTree(5, 3); drawTree(-6, -4); drawTree(8, -5); drawTree(6, 4);
    drawTree(-5, -6); drawTree(7, -7); drawTree(-9, 5); drawTree(10, 2);

    // Draw moving clouds
    drawCloud(5 + 2 * sin(sunAngle), 15, -5);  // Cloud with slight movement
    drawCloud(-10 + 2 * cos(sunAngle), 17, 6); // Second moving cloud
    
    drawSmoke(); // Chimney smoke

    // Draw all characters
    for (int i = 0; i < MAX_PEOPLE; i++) {
        drawPerson(&people[i]);
    }
    
    // Draw precipitation if active
    if (weatherMode == 1 || weatherMode == 2) drawRainOrSnow();

    // Ensure fog is disabled for next frame
    glDisable(GL_FOG);
    
    // Swap buffers to display rendered scene
    glutSwapBuffers();
}

/**
 * Keyboard input handler
 * @param key ASCII key pressed
 * @param x X coordinate of mouse when key pressed
 * @param y Y coordinate of mouse when key pressed
 */
void keyboard(unsigned char key, int x, int y) {
    switch (key) {
        case 'd': case 'D': 
            isDay = 1; // Switch to daytime
            break;
        case 'n': case 'N': 
            isDay = 0; // Switch to nighttime
            break;
        case '+': 
            zoom += 1.0; // Zoom in
            break;
        case '-': 
            zoom -= 1.0; // Zoom out
            break;
        case 'w': case 'W':
            // Cycle through weather modes
            weatherMode = (weatherMode + 1) % 4; 
            break;
    }
}

/**
 * Special key handler (arrow keys)
 * @param key GLUT key constant
 * @param x X coordinate of mouse
 * @param y Y coordinate of mouse
 */
void specialKeys(int key, int x, int y) {
    switch (key) {
        case GLUT_KEY_LEFT: 
            cameraAngle -= 2.0; // Rotate view left
            break;
        case GLUT_KEY_RIGHT: 
            cameraAngle += 2.0; // Rotate view right
            break;
    }
}

/**
 * Initialize OpenGL settings
 * Sets up lighting, materials, and other rendering parameters
 */
void init() {
    srand(time(0)); // Seed random number generator
    
    // Enable depth testing for 3D rendering
    glEnable(GL_DEPTH_TEST);
    
    // Enable lighting
    glEnable(GL_LIGHTING);
    glEnable(GL_LIGHT0); // Use light source 0
    
    // Enable color material for colored objects
    glEnable(GL_COLOR_MATERIAL);
    
    // Use smooth shading
    glShadeModel(GL_SMOOTH);
    
    // Enable blending for transparency
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    
    // Set up perspective projection
    glMatrixMode(GL_PROJECTION);
    gluPerspective(45.0, 1.0, 1.0, 100.0);
    glMatrixMode(GL_MODELVIEW);
    
    // Initialize character positions
    initPeople();
}

/**
 * Window resize handler
 * @param w New window width
 * @param h New window height
 */
void reshape(int w, int h) {
    // Set viewport to new dimensions
    glViewport(0, 0, w, h);
    
    // Update projection matrix
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluPerspective(45.0, (float)w / (float)h, 1.0, 100.0);
    glMatrixMode(GL_MODELVIEW);
}

/**
 * Update character positions and states
 * Handles walking animation and movement logic
 */
void updatePeople() {
    for (int i = 0; i < MAX_PEOPLE; i++) {
        Person* p = &people[i];
        p->timer++; // Increment state timer
        
        if (p->state == 0) { // Standing state
            // After random interval, start walking
            if (p->timer > 100 + rand() % 100) {
                p->state = 1; // Change to walking
                p->angle = rand() % 360; // Random direction
                p->timer = 0; // Reset timer
            }
        } 
        else { // Walking state
            /* LEG ANIMATION */
            p->legAngle += p->legDirection * 2.0; // Swing legs
            if (fabs(p->legAngle) > 15.0) { // Reverse at max angle
                p->legDirection *= -1;
            }
            
            /* MOVEMENT */
            // Move forward in facing direction
            p->x += sin(p->angle * M_PI / 180.0) * p->speed;
            p->z += cos(p->angle * M_PI / 180.0) * p->speed;
            
            /* RANDOM DIRECTION CHANGE */
            if (rand() % 100 < 2) { // 2% chance per frame
                p->angle += (rand() % 60) - 30; // -30 to +30 degree change
            }
            
            /* BOUNDARY CHECK */
            if (p->x < -20 || p->x > 20 || p->z < -20 || p->z > 20) {
                p->angle += 180; // Turn around at edge
            }
            
            /* RANDOM STOP */
            if (p->timer > 200 + rand() % 200) { // After random interval
                p->state = 0; // Stop walking
                p->timer = 0;
                p->legAngle = 0; // Reset legs
            }
        }
    }
}


/**
 * Render a person character
 * @param p Pointer to Person struct
 */
void drawPerson(Person* p) {
    glPushMatrix();
    glTranslatef(p->x, 0.0, p->z);           // Position the person
    glRotatef(p->angle, 0.0, 1.0, 0.0);      // Face the direction

    /* BODY */
    glColor3f(0.8, 0.6, 0.4);                // Shirt color
    glPushMatrix();
    glTranslatef(0.0, 1.0, 0.0);             // Move up to chest height
    glScalef(0.4, 0.6, 0.2);                 // Scale to torso shape
    glutSolidCube(1.0);
    glPopMatrix();

    /* HEAD */
    glColor3f(1.0, 0.8, 0.6);                // Skin color
    glPushMatrix();
    glTranslatef(0.0, 1.6, 0.0);             // Head position
    glutSolidSphere(0.2, 10, 10);            // Spherical head
    glPopMatrix();

    /* LEGS (animated swing) */
    glColor3f(0.2, 0.2, 0.8);                // Pants color

    // Left leg
    glPushMatrix();
    glTranslatef(-0.1, 0.4, 0.0);
    glRotatef(p->legAngle, 1.0, 0.0, 0.0);   // Swing animation
    glTranslatef(0.0, -0.4, 0.0);
    glScalef(0.1, 0.8, 0.1);
    glutSolidCube(1.0);
    glPopMatrix();

    // Right leg
    glPushMatrix();
    glTranslatef(0.1, 0.4, 0.0);
    glRotatef(-p->legAngle, 1.0, 0.0, 0.0);  // Opposite swing
    glTranslatef(0.0, -0.4, 0.0);
    glScalef(0.1, 0.8, 0.1);
    glutSolidCube(1.0);
    glPopMatrix();

    glPopMatrix();
}



/**
 * Animation timer callback
 * @param value Timer value (unused)
 */
void timer(int value) {
    /* DAY/NIGHT CYCLE */
    if (isDay) {
        sunAngle += 0.005; // Advance sun
        if (sunAngle >= 3.14) isDay = 0; // Switch to night at sunset
    } else {
        sunAngle -= 0.005; // Advance moon
        if (sunAngle <= 0.0) isDay = 1; // Switch to day at sunrise
    }
    
    /* LIGHT FLICKER FOR NIGHT */
    lightFlicker = 0.7 + 0.3 * ((rand() % 10) / 10.0);
    
    /* SMOKE ANIMATION */
    smokeY += 0.01;
    
    /* UPDATE CHARACTERS */
    updatePeople();
    
    /* REDRAW SCENE */
    glutPostRedisplay();
    
    /* RESET TIMER */
    glutTimerFunc(16, timer, 0); // ~60fps
}

/**
 * Main program entry point
 * @param argc Argument count
 * @param argv Argument vector
 * @return Program exit status
 */
int main(int argc, char** argv) {
    // Initialize GLUT
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_RGB | GLUT_DOUBLE | GLUT_DEPTH);
    
    // Create window
    glutInitWindowSize(900, 700);
    glutCreateWindow("Cabin in the Hills - OpenGL");
    
    // Initialize OpenGL
    init();
    
    // Register callbacks
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutKeyboardFunc(keyboard);
    glutSpecialFunc(specialKeys);
    glutTimerFunc(0, timer, 0);
    
    // Start main loop
    glutMainLoop();
    
    return 0;

}
