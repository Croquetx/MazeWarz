// Maze Wars
// Croquet Corporation, 2020

const Q = Croquet.Constants;
// Pseudo-globals
// These need to be even numbers
Q.MAZE_ROWS = 20;
Q.MAZE_COLUMNS = 20;
Q.CELL_SIZE = 2;
Q.WALL_THICKNESS = 0.1;
Q.WALL_HEIGHT = 1;
Q.COLUMN_RADIUS = 0.1;

// Demo
Q.NUM_BALLS = 12;            // number of bouncing balls
Q.BALL_RADIUS = 0.25;
Q.CENTER_SPHERE_RADIUS = 1.5;  // a large sphere to bounce off
Q.CENTER_SPHERE_NEUTRAL = 0xaaaaaa; // color of sphere before any bounces
Q.CONTAINER_SIZE = 4;        // edge length of invisible containing cube
Q.STEP_MS = 1000 / 20;       // step time in ms
Q.SPEED = 1.5;               // max speed on a dimension, in units/s


var mazeGenerator = {
  map    : [],
  WIDTH  : 20,
  HEIGHT : 20,

  DIRECTIONS : {
    'N' : { dy: -1, opposite: 'S' },
    'S' : { dy:  1, opposite: 'N' },
    'E' : { dx:  1, opposite: 'W' },
    'W' : { dx: -1, opposite: 'E' }
  },

  prefill : function () {
    for (var x = 0; x < this.WIDTH; x++) {
      this.map[x] = [];
      for (var y = 0; y < this.HEIGHT; y++) {
        this.map[x][y] = {};
      }
    }
  },

  shuffle : function (o) {
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
  },

  carve : function (x0, y0, direction) {
    //console.log('[%d, %d, "%s"]', x0, y0, direction);

    var x1 = x0 + (this.DIRECTIONS[direction].dx || 0),
        y1 = y0 + (this.DIRECTIONS[direction].dy || 0);

    if (x1 == 0 || x1 == this.WIDTH || y1 == 0 || y1 == this.HEIGHT) {
      return;
    }

    if ( this.map[x1][y1].seen ) {
      return;
    }

    this.map[x0][y0][ direction ] = true;
    this.map[x1][y1][ this.DIRECTIONS[direction].opposite ] = true;
    this.map[x1][y1].seen = true;

    var directions = this.shuffle([ 'N', 'S', 'E', 'W' ]);
    for (var i = 0; i < directions.length; i++) {
      this.carve(x1, y1, directions[i]);
    }
  },

  braid: function () {
    for (var y = 1; y < this.HEIGHT-1; y++) {
      for (var x = 1; x < this.WIDTH-1; x++) {
        if(!(this.map[x][y].S || this.map[x][y].E || this.map[x][y].N)) 
          this.map[x][y].E = true;
        if(!(this.map[x][y].E || this.map[x][y].N || this.map[x][y].W)) 
          this.map[x-1][y].S = true;
        if(!(this.map[x][y].N || this.map[x][y].W || this.map[x][y].S)) 
          this.map[x][y-1].E = true;
        if(!(this.map[x][y].W || this.map[x][y].S || this.map[x][y].W))
          this.map[x][y].S = true;
      }
    }
  },

  clean: function () {// remove N and W
    for (var y = 0; y < this.HEIGHT; y++) {
      for (var x = 0; x < this.WIDTH; x++) {
        delete this.map[x][y].N;
        delete this.map[x][y].W;
        delete this.map[x][y].seen;
      }
    }
  },

  construct: function(width, height){
    console.log("mazeGenerator.construct()")
    if(width)this.WIDTH = width;
    if(height)this.HEIGHT = height;
    this.prefill();
    this.carve(this.WIDTH/2, this.HEIGHT/2, 'N');
    this.braid();
    this.clean();
    console.log(this.output())
    return this.map;
  },
  
  output : function () {
    var output = '';
    for (var y = 0; y < this.HEIGHT; y++) {
      for (var x = 0; x < this.WIDTH; x++) {
        if(x>0)output += ( this.map[x][y].S ? ' ' : '_' );
        output += ( this.map[x][y].E ? ' ' : y==0?' ':'!' );
      }
      output += '\n';
    }
    output = output.replace(/_ /g, '__');
    return output;
  }
};


  

class MyModel extends Croquet.Model {
  
    init(options) {
      // force init 13
        super.init(options);
        this.map = mazeGenerator.construct(Q.MAZE_ROWS, Q.MAZE_COLUMNS);
        this.centerSphereRadius = Q.CENTER_SPHERE_RADIUS;
        this.centerSpherePos = [0, 0, -Q.CONTAINER_SIZE/2]; // embedded half-way into the back wall
        this.children = [];
        for (let i = 0; i < Q.NUM_BALLS; i++) this.children.push(BallModel.create({ sceneModel: this }));
        this.subscribe(this.id, 'sphere-drag', this.centerSphereDragged); // someone is dragging the center sphere
        this.subscribe(this.id, 'reset', this.resetCenterSphere); // someone has clicked the center sphere
    }
  
    centerSphereDragged(pos) {
        this.centerSpherePos = pos;
        this.publish(this.id, 'sphere-pos-changed', pos);
    }

    resetCenterSphere() {
        this.publish(this.id, 'recolor-center-sphere', Q.CENTER_SPHERE_NEUTRAL);
    }
}

MyModel.register();

class BallModel extends Croquet.Model {

    init(options={}) {
        super.init();
        this.sceneModel = options.sceneModel;

        const rand = range => Math.floor(range * Math.random()); // integer random less than range
        this.radius = Q.BALL_RADIUS;
        this.color = `hsl(${rand(360)},${rand(50)+50}%,50%)`;
        this.resetPosAndSpeed();
      
        this.subscribe(this.sceneModel.id, 'reset', this.resetPosAndSpeed); // the reset event will be sent using the model id as scope

        this.future(Q.STEP_MS).step();
    }
  
    // a ball resets itself by positioning at the center of the center-sphere
    // and giving itself a randomized velocity
    resetPosAndSpeed() {
        const srand = range => range * 2 * (Math.random() - 0.5); // float random between -range and +range
        this.pos = this.sceneModel.centerSpherePos.slice();
        const speedRange = Q.SPEED * Q.STEP_MS / 1000; // max speed per step
        this.speed = [ srand(speedRange), srand(speedRange), srand(speedRange) ];
    }

    step() {
        this.moveBounce();
        this.future(Q.STEP_MS).step(); // arrange to step again
    }

    moveBounce() {
        this.bounceOffContainer();
        this.bounceOffCenterSphere();
        const pos = this.pos;
        const speed = this.speed;
        this.moveTo([ pos[0] + speed[0], pos[1] + speed[1], pos[2] + speed[2] ]);
    }
      
    bounceOffCenterSphere() {
        const pos = this.pos;
        const spherePos = this.sceneModel.centerSpherePos; // a model is allowed to read state of another model
        const distFromCenter = posArray => {
            let sq = 0;
            posArray.forEach((p, i) => {
                const diff = spherePos[i] - p;
                sq += diff * diff;
              });
            return Math.sqrt(sq);
            };
        const speed = this.speed;
        const threshold = Q.CENTER_SPHERE_RADIUS + this.radius;
        const distBefore = distFromCenter(pos);
        const distAfter = distFromCenter([ pos[0] + speed[0], pos[1] + speed[1], pos[2] + speed[2] ]);
        if (distBefore >= threshold && distAfter < threshold) {
            const unitToCenter = pos.map((p, i) => (spherePos[i] - p)/distBefore);
            const speedAcrossBoundary = speed[0] * unitToCenter[0] + speed[1] * unitToCenter[1] + speed[2] * unitToCenter[2];
            this.speed = this.speed.map((v, i) => v - 2 * speedAcrossBoundary * unitToCenter[i]);
            this.publish(this.sceneModel.id, 'recolor-center-sphere', this.color);
        }
    }

    bounceOffContainer() {
        const pos = this.pos;
        const speed = this.speed;
        pos.forEach((p, i) => {
            if (Math.abs(p) > Q.CONTAINER_SIZE/2 - this.radius) speed[i] = Math.abs(speed[i]) * -Math.sign(p);
            });
    }

    // the ball moves by recording its new position, then publishing that 
    // position in an event that its view is expected to have subscribed to
    moveTo(pos) {
        this.pos = pos;
        this.publish(this.id, 'pos-changed', this.pos);
    }
}

BallModel.register();

// one-time function to set up Three.js, with a simple lit scene
function setUpScene() {
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(50, 50, 50);
    scene.add(light);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 0, 4); 
    const threeCanvas = document.getElementById("three");
    const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas });
    renderer.setClearColor(0xaa4444);

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();

    // utility objects for managing pointer interaction
    const raycaster = new THREE.Raycaster();
    let dragObject = null;
    let dragged;
    const dragOffset = new THREE.Vector3();
    const dragPlane = new THREE.Plane();
    const mouse = new THREE.Vector2();
    const THROTTLE_MS = 1000 / 20; // minimum delay between pointer-move events that we'll handle
    let lastTime = 0;
    function setMouse(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    function onPointerDown(event) {
        event.preventDefault();
        setMouse(event); // convert from window coords to relative (-1 to +1 on each of x, y)
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children);
	      for (let i = 0; i < intersects.length && !dragObject; i++) {
            const intersect = intersects[i];
            const threeObj = intersect.object;
            if (threeObj.q_draggable) { // a flag that we set on just the central sphere
                dragObject = threeObj;
                dragged = false; // so we can detect a non-dragging click
                dragOffset.subVectors(dragObject.position, intersect.point); // position relative to pointer
                // set up for drag in vertical plane perpendicular to camera direction
                dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), intersect.point);
            }
        }
	  }
    threeCanvas.addEventListener('pointerdown', onPointerDown);

    function onPointerMove(event) {
        event.preventDefault();

        // ignore if there is no drag happening
        if (!dragObject) return;
      
        // ignore if the event is too soon after the last one 
        if (event.timeStamp - lastTime < THROTTLE_MS) return;
        lastTime = event.timeStamp;

        const lastMouse = {...mouse};
        setMouse(event);
        // ignore if the event is too close on the screen to the last one
        if (Math.abs(mouse.x-lastMouse.x) < 0.01 && Math.abs(mouse.y - lastMouse.y) < 0.01) return;

        raycaster.setFromCamera(mouse, camera);
        const dragPoint = raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3());
        dragObject.q_onDrag(new THREE.Vector3().addVectors(dragPoint, dragOffset));
        dragged = true; // a drag has happened (so don't treat the pointerup as a click)
	  }
    threeCanvas.addEventListener('pointermove', onPointerMove);

    function onPointerUp(event) {
        event.preventDefault();
        if (dragObject) {
            if (!dragged && dragObject.q_onClick) dragObject.q_onClick(); 
            dragObject = null;
        }
	  }
    threeCanvas.addEventListener('pointerup', onPointerUp);

    // function that the app must invoke when ready to render the scene 
    // on each animation frame.
    function sceneRender() { renderer.render(scene, camera); }
  
    return { scene, sceneRender };
}

class MyView extends Croquet.View {

    constructor(model) {
        super(model);
        this.sceneModel = model;
        const sceneSpec = setUpScene(); // { scene, sceneRender }
        this.scene = sceneSpec.scene;
        this.sceneRender = sceneSpec.sceneRender;
        // construct the maze
        this.constructMaze(model.map);
      
        this.centerSphere = new THREE.Mesh(
          new THREE.SphereGeometry(model.centerSphereRadius, 16, 16),
          new THREE.MeshStandardMaterial({ color: Q.CENTER_SPHERE_NEUTRAL, roughness: 0.7 }));
        this.centerSphere.position.fromArray(model.centerSpherePos);
        this.scene.add(this.centerSphere);
        // set Croquet app-specific properties for handling events
        this.centerSphere.q_onClick = () => this.publish(model.id, 'reset');
        this.centerSphere.q_draggable = true;
        this.centerSphere.q_onDrag = posVector => this.posFromSphereDrag(posVector.toArray());
        this.subscribe(model.id, 'sphere-pos-changed', this.moveSphere);
        this.subscribe(model.id, 'recolor-center-sphere', this.recolorSphere);
        model.children.forEach(childModel => this.attachChild(childModel));
    }
  
    constructMaze(map){
//Q.MAZE_ROWS = 20;
//Q.MAZE_COLUMNS = 20;
//Q.CELL_SIZE = 2;
//Q.WALL_THICKNESS = 1;
//Q.WALL_HEIGHT = 0.1;
//Q.COLUMN_RADIUS = 0.1;
      //console.log("constructMaze(map)");
      //console.log(map);
      var geometry;
      var material;
      var mesh;
      var group;
      group = new THREE.Group();
      
      var offsetX = Q.MAZE_COLUMNS*Q.CELL_SIZE/2;
      var offsetY = Q.MAZE_ROWS*Q.CELL_SIZE/2;
      
      for (var y = 0; y < Q.MAZE_ROWS; y++) {
          for (var x = 0; x < Q.MAZE_COLUMNS; x++) {
              
            // columns
              geometry = new THREE.BoxBufferGeometry( Q.COLUMN_RADIUS*2, Q.WALL_HEIGHT, Q.COLUMN_RADIUS*2);
			        material = new THREE.MeshStandardMaterial( {color: 0x666666, roughness: 0.7 } );
			        mesh = new THREE.Mesh( geometry, material );
              mesh.position.x = x*Q.CELL_SIZE-offsetX;
              mesh.position.y = 0;
              mesh.position.z = y*Q.CELL_SIZE-offsetY;
			        group.add( mesh );
            // walls
              if(!map[x][y].S && x>0){// || y==1 || y==Q.MAZE_ROWS-1){
                  geometry = new THREE.BoxBufferGeometry( Q.CELL_SIZE-Q.COLUMN_RADIUS, Q.WALL_HEIGHT, Q.WALL_THICKNESS);
			            material = new THREE.MeshStandardMaterial( {color: 0x8888CC, roughness: 0.7 }  );
			            mesh = new THREE.Mesh( geometry, material );    
                  mesh.position.x = x*Q.CELL_SIZE-offsetX - Q.CELL_SIZE/2;
                  mesh.position.y = 0;
                  mesh.position.z = y*Q.CELL_SIZE - offsetY;
                  group.add( mesh );
              }
              
            
               if(!map[x][y].E && y>0){// || x==1 || x==Q.MAZE_COLUMNS-1){
                  geometry = new THREE.BoxBufferGeometry( Q.WALL_THICKNESS, Q.WALL_HEIGHT, Q.CELL_SIZE-Q.COLUMN_RADIUS );
			            material = new THREE.MeshStandardMaterial( {color: 0x8888CC, roughness: 0.7 } );
			            mesh = new THREE.Mesh( geometry, material );    
                  mesh.position.x = x*Q.CELL_SIZE-offsetX;
                  mesh.position.y = 0;
                  mesh.position.z = (y+1)*Q.CELL_SIZE - 3*Q.CELL_SIZE/2 - offsetY;
                  group.add( mesh );
              }   
              
        }
      }      
      group.position.z = -10;
      group.position.y = -5;
      //group.rotation.x = Math.PI/2;
      this.scene.add(group);
      console.log(mesh);
    }
  
  
    posFromSphereDrag(pos) {
        const limit = Q.CONTAINER_SIZE / 2;
        // constrain x and y to container (z isn't expected to be changing)
        [0, 1].forEach(i => { if (Math.abs(pos[i]) > limit) pos[i] = limit * Math.sign(pos[i]); });
        this.publish(this.sceneModel.id, 'sphere-drag', pos);
    }

    moveSphere(pos) {
        // this method just moves the view of the sphere
        this.centerSphere.position.fromArray(pos);
    }
  
    recolorSphere(color) {
        this.centerSphere.material.color.copy(new THREE.Color(color));
    }
  
    attachChild(childModel) {
        this.scene.add(new BallView(childModel).object3D);
    }
  
    update(time) {
        this.sceneRender();
    }

    showStatus(backlog, starvation, min, max) {
      const color = backlog > starvation ? '255,0,0' : '255,255,255';
      const value = Math.max(backlog, starvation) - min;
      const size = Math.min(value, max) * 100 / max;
      const alpha = size / 100;
      this.element.style.boxShadow = alpha < 0.2 ? "" : `inset 0 0 ${size}px rgba(${color},${alpha})`;
    }
}

class BallView extends Croquet.View {

    constructor(model) {
        super(model);
        this.object3D = new THREE.Mesh(
          new THREE.SphereGeometry(model.radius, 12, 12),
          new THREE.MeshStandardMaterial({ color: model.color })
          );
        this.move(model.pos);
        this.subscribe(model.id, { event: 'pos-changed', handling: 'oncePerFrame' }, this.move);
    }

    move(pos) {
        this.object3D.position.fromArray(pos);
    }
}

Croquet.startSession("MazeWarz", MyModel, MyView);

Croquet.App.messages = true;
CroquetApp.makeWidgetDock({badge: true, qrcode: true});