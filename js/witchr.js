/**
 * @fileoverview witchr 48 hour game jam for orcajam 2016. 
 * @author @superafable
 */


'use strict';



(function( witchr, undefined ) {

	// debugging toggle
	let de = true;
	let bug = console;

	
	// enums
	let Canvas, Game, Player, Keyboard, Key, Mouse, Wall;

	// fps stats
	let stats;

	// game and room stage logic
	let game = {};

	// hud and dimmer
	let hud, base = './img/', dimmer;

	// cannon.js
	let world, wf = 0.0, wr = 0.0; // wf (world friction), wr (world restitution)
	let t = 0, dt = 1/240, newTime, frameTime, currTime = performance.now(), accumulator = 0;
	let floorBody, fw = 50, fd = 50;
	let eyeBody, er = 3, em = 10, eld = 0.99; // er (eye radius), em (eye mass), eld (eye linear damping)
	let physicsMaterial;
	
	// three.js
	let camera, scene, renderer, raycaster, mouse, pickDistance = 5;
	let floor, eye;
	let pickObjects, notes, nw = 3, nh = 3, nd = 0.001, noteFiles = ['note1.png', 'note2.png', 'news-min.jpg'], readCount = 0;

	// mouse and touch events
	let rotX = 0;
	let rotY = 0;

	let targetRotationX = 0;
	let targetRotationOnMouseDownX = 0;
	let targetRotationY = 0;
	let targetRotationOnMouseDownY = 0;

	let mouseX = 0;
	let mouseXOnMouseDown = 0;
	let mouseY = 0;
	let mouseYOnMouseDown = 0;

	let isMouseLeftDown = false;
	let isMouseRightDown = false;

	let windowHalfX = window.innerWidth/2;
	let windowHalfY = window.innerHeight/2;


	window.onload = init();


	/*********************************************************
	 * initialize scene 
	 *********************************************************
	 */
	function init() {

		// init game object
		initEnums();
		initCannon();	// init global cannonjs bodies
		initThree();	// init global threejs meshes
		initGame();

		// init stats
		stats = witchr.Stats();
		document.body.appendChild( stats.dom );

		// add handlers for io events
		window.addEventListener( 'resize', onWindowResize, false );

		window.addEventListener( 'keydown', Keyboard.keyPress.bind(Keyboard), false );
		window.addEventListener( 'keyup', Keyboard.keyRelease.bind(Keyboard), false );

		document.addEventListener( 'mousedown', onDocumentMouseDown, false );
		document.addEventListener( 'mousemove', onDocumentMouseMove, false );
		document.addEventListener( 'mouseup', onDocumentMouseUp, false);
		// document.addEventListener( 'mouseout', onDocumentMouseUp, false);
		// disable contextmenu on right clicks (will be used to move)
		window.oncontextmenu = function() { return false; };

		document.addEventListener( 'touchstart', onDocumentTouchStart, false );
		document.addEventListener( 'touchmove', onDocumentTouchMove, false );
		document.addEventListener( 'touchend', onDocumentTouchEnd, false );


		// start an rAF for the gameloop
		requestAnimationFrame( gameloop );

	}

	
	// init global cannonjs logic, not including room specific stuff
	function initCannon() {


		let physicsContactMaterial;
		let shape;


		// setup world of physics
		world = new CANNON.World();
		world.broadphase = new CANNON.NaiveBroadphase();
		world.solver.iterations = 1;
		world.gravity.set( 0, -10, 0 );


		// setup floor physics body
		// create a slippery material
		physicsMaterial = new CANNON.Material( 'floorMaterial' );
		physicsContactMaterial = new CANNON.ContactMaterial( physicsMaterial, 
															 physicsMaterial, 
														   { friction: wf,
															 restitution: wr
														   } );
		world.addContactMaterial( physicsContactMaterial );
		// floor plane body which acts as room floor
		// floor will be on y=0 and all bodies will be init with that in mind
		shape = new CANNON.Plane();
		floorBody = new CANNON.Body( { mass: 0, material: physicsMaterial } );
		floorBody.addShape( shape );
		floorBody.quaternion.setFromAxisAngle( new CANNON.Vec3( 1, 0, 0 ), 
											   -90*THREE.Math.DEG2RAD
											 );
		world.addBody( floorBody );
		floorBody.position.z += fd/2;
		

		// setup eye physics body that simulates and positions player
		shape = new CANNON.Sphere( er );
		eyeBody = new CANNON.Body( { mass: em, material: physicsMaterial } );
		eyeBody.addShape( shape );
		eyeBody.linearDamping = eld;
		eyeBody.position.set( 0, er, fd/2 );
		world.addBody( eyeBody );

		
	}


	// init global threejs logic, not including room specific stuff
	function initThree() {
		
		pickObjects = [], notes = [];
		let geometry, material, texture, mats = [];
		let paper;

		// create dimmer div that will appear in front of canvas and act as a
		// 	'lighting dimmer' when hud is being interacted with
		dimmer = document.createElement( 'div' );
		document.body.appendChild( dimmer );
		dimmer.style.cssText = 'background: #000000; opacity: 0; transition: opacity 0.5s; width: 100vw; height: 100vh; position: fixed; z-index: 100;';
		
		
		// create hud img that will display all hud screens for game such as
		// 	splash img, ending img, and notes
		hud = document.createElement( 'img' );
		document.body.appendChild( hud );
		initHUD( hud, base );
		// show splash screen as the intro img
		hud.show( 'splash-min.jpg', { width: '100vw', height: '100vh' } );


		// init camera
		camera = new THREE.PerspectiveCamera( 75, 
											  window.innerWidth / window.innerHeight, 
											  0.1, 
											  220 
											);
		camera.lookAt( 0, 0, 0 );


		// init scene
		scene = new THREE.Scene();
		// scene.fog = new THREE.Fog( 0x000000, 0.01, 3 );
		// scene.fog = new THREE.FogExp2( 0x000000, 0.8 );
		scene.add( camera );
		// raycaster used in picking objects
		raycaster = new THREE.Raycaster();
		mouse = new THREE.Vector2();


		// init renderer
		renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.setSize( window.innerWidth * Canvas.SIZE, 
						  window.innerHeight * Canvas.SIZE
						);
		renderer.setClearColor( 0x000000 );
		document.body.appendChild( renderer.domElement );


		// create floor mesh that acts as the room floor
		geometry = new THREE.PlaneGeometry( fw, fd, 1, 1 );
		texture = new THREE.TextureLoader().load( './img/old_wood-min.jpg' );
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( 2, 1 );
		material = new THREE.MeshBasicMaterial( { map: texture, 
												  side: THREE.DoubleSide 
												} );
		floor =  new THREE.Mesh( geometry, material );
		scene.add( floor );


		// create eye mesh to render eye body for troubleshooting
		geometry = new THREE.SphereGeometry( er, 16, 16 );
		material = new THREE.MeshBasicMaterial( { color: 0xff0000, 
												  wireframe: true, 
												  transparent: true, 
												  opacity: 0.1 
											  } );
		eye = new THREE.Mesh( geometry, material );
		scene.add( eye );
		camera.position.copy( eye.position );
		// place camera at the very top of eye mesh
		camera.position.y += er;
		eye.add( camera );
		





		let ww = 50, wd = 1, dh = 11;
		// create notes that will be spread all over room
		geometry = new THREE.BoxGeometry( nw, nh, nd );
		// create all notes
		for ( let i = 0; i < noteFiles.length; ++i ) {
			// create texture for each note
			texture = new THREE.TextureLoader().load( base + noteFiles[i] );
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.repeat.set( 1, 1 );
			material = new THREE.MeshBasicMaterial( { map: texture, alphaTest: 0.5 } );
			paper = new THREE.Mesh( geometry, material );
			paper.position.set( ww/3*i - ww/3, dh/2, ww-wd );
			initNote( paper, noteFiles[i] );
			scene.add( paper );
			notes.push( paper );
			pickObjects.push( paper );
		}
		paper = null;
		

	}


	function initGame() {

		let room = {};

		// window.cancelAnimationFrame( game.stopGameLoop ) can be called to stopGameLoop
		// 	the main requestAnimationFrame() loop
		game.stopGameLoop = 0;
		// start game on it's initial room
		game.currRoom = 0;
		// setup each room in the game, each room contains doors, walls, and notes
		game.numRooms = Game.NUM_ROOMS;
		game.rooms = [];

		
		// setup room 0 doors, walls, notes
		room.state = Game.NO_ANSWER;
		// create doors
		room.NUM_DOORS = 1;
		room.modelsLoaded = 0;
		room.allModelsLoaded = false;
		room.doors = [];
		room.doors.push( createDoor( room, {
				doorWidth: 8, doorHeight: 11, doorDepth: 0.5,
				doorOffset: 0.5, doorMass: 10, doorLinearDamping: 0.66,
				doorPosition: { x : 0, y : 0, z : 0 },
				doorRotation: { x: 0, y: 0, z: 0 },
				doorAnswer: Game.CORRECT_ANSWER,
				doorFaceFrontTexture: './img/door_face_front-min.jpg',
				doorFaceSideTexture: './img/door_face_side-min.jpg',
				doorHandleModel: './model/door_handle.json',
				doorHandleTexture: './img/door_handle-min.jpg',
				doorOpenFunc: function () {
					if ( readCount === noteFiles.length ) {
						this.body.open();
					}
				}
		} ) );

		room.NUM_WALLS = 4;
		room.walls = [];

		room.walls.push( createWall( {
				wallWidth: 50, wallHeight: 20, wallDepth: 1,
				wallPosition: { x: 0, y: 0, z: 0 },
				wallRotation: { x: 0, y: 0, z: 0 },
				wallMass: 0,
				wallDoors: [room.doors[0]],
				wallTexture: './img/wallpaper-min.jpg'
		} ) );
		room.walls.push( createWall( {
				wallWidth: 50, wallHeight: 20, wallDepth: 1,
				wallPosition: { x: 25, y: 0, z: 25 },
				wallRotation: { x: 0, y: 90, z: 0 },
				wallMass: 0,
				wallDoors: [],
				wallTexture: './img/wallpaper-min.jpg'
		} ) );
		room.walls.push( createWall( {
				wallWidth: 50, wallHeight: 20, wallDepth: 1,
				wallPosition: { x: 0, y: 0, z: 50 },
				wallRotation: { x: 0, y: 0, z: 0 },
				wallMass: 0,
				wallDoors: [],
				wallTexture: './img/wallpaper-min.jpg'
		} ) );
		room.walls.push( createWall( {
				wallWidth: 50, wallHeight: 20, wallDepth: 1,
				wallPosition: { x: -25, y: 0, z: 25 },
				wallRotation: { x: 0, y: 90, z: 0 },
				wallMass: 0,
				wallDoors: [],
				wallTexture: './img/wallpaper-min.jpg'
		} ) );



		// let wallsBody, ww = fd, wh = 20, wd = 1, wm = 0, wn = 3; // wm (wall mass), wn (# of non-door walls)
		// let wallDoorBody, wallDoor;
		// wallsBody = [];
		// let shape;

		// let geometry, material, texture, mats = [];
		// let walls = [],  wallDoorT, wallDoorL, wallDoorR;

		// let dw = 8, dh = 11, dd = 0.5;










		// create notes
		

		
		
		
		
		// check if player has exited room through a door
		room.checkExitCondition = function() {
			
			// WIP: generally, best way to do this is to get the exit condition for the whole room and if it is true, run the exit function for the closest door to the player on exit.

			if ( eye.position.z < 0 ) {
				room.state = Game.CORRECT_ANSWER;
			}
		};

		// win and exit room
		room.win = function() {
			hud.show( 'end-min.jpg', { width: '100vw', height: '100vh' } );
		};

		// lose room logic
		room.lose = function() {
		};

		// add this room to the array of game rooms
		game.rooms.push( room );

		// setup more rooms...

	}



	/*********************************************************
	 * main game loop
	 *********************************************************
	 */
	function gameloop() {

		game.stopGameLoop = requestAnimationFrame( gameloop );

		newTime = performance.now();
		frameTime = newTime - currTime;
		frameTime *= 0.001; // need frame time in seconds 
		currTime = newTime;

		accumulator += frameTime;

		while ( accumulator >= dt ) {

			// only handle inputs and update physics once all models are loaded
			if ( game.rooms[game.currRoom].allModelsLoaded ) {
				handleInputs( dt );
				updatePhysics();
			}

			accumulator -= dt;
			t += dt;

		}


		renderer.render( scene, camera ); // render the scene
		stats.update();

	}

	function updatePhysics() {

		let room = game.rooms[game.currRoom];


		world.step( dt );


		// reset eye quaternion so we always rotate offset from origin
		eyeBody.quaternion.set( 0, 0, 0, 1 );
		// local rotation about the y-axis
		let rotSide = new CANNON.Quaternion( 0, 0, 0, 1 );
		rotSide.setFromAxisAngle( new CANNON.Vec3( 0, 1, 0 ), rotY );
		eyeBody.quaternion = eyeBody.quaternion.mult( rotSide );
		// local rotation about the x-axis
		let rotUp = new CANNON.Quaternion( 0, 0, 0, 1 );
		rotUp.setFromAxisAngle( new CANNON.Vec3( 1, 0, 0 ), rotX );
		eyeBody.quaternion = eyeBody.quaternion.mult( rotUp );


		// update all of meshes to their physics bodies
		eye.position.copy( eyeBody.position );
		eye.quaternion.copy( eyeBody.quaternion );

		floor.position.copy( floorBody.position );
		floor.quaternion.copy( floorBody.quaternion );
		
		for ( let i = 0; i < room.doors.length; ++i ) {
			let door = room.doors[i];
			door.position.copy( door.body.position );
			door.quaternion.copy( door.body.quaternion );
			door.handle.update();
			
			// if a door is open, check if player exited
			if ( door.open ) {
				room.checkExitCondition();
				if ( room.state ) {
					if ( room.state === Game.CORRECT_ANSWER ) {
						room.win();
					}
					if ( room.state === Game.WRONG_ANSWER ) {
						room.lose();
					}
				}
			}
		}

		for ( let i = 0; i < room.walls.length; ++i ) {
			let wall = room.walls[i];
			wall.position.copy( wall.body.position );
			wall.quaternion.copy( wall.body.quaternion );
		}

	}


	/*********************************************************
	 * handle keyboard, mouse, touch inputs
	 *********************************************************
	 */
	function handleInputs( deltaTime ) {

		// get the rotation offset values from mouse and touch input
		rotX += ( targetRotationX - rotX ) * Player.ROTATE_SPEED * deltaTime;
		rotY += ( targetRotationY - rotY ) * Player.ROTATE_SPEED * deltaTime;

		// get the input velocity for translation, euler angle that describes
		// 	the current rotation transformation and quaternion to apply the
		// 	euler angle transform to the input vector
		let inputVelocity, euler, quat;
		inputVelocity = new THREE.Vector3( 0, 0, 0 );
		euler = new THREE.Euler( 0, rotY, 0, 'XYZ' );
		quat = new THREE.Quaternion();
		quat.setFromEuler( euler );

		// translate only in x,z and make sure to keep y position static
		if ( Keyboard.keys[Key.LEFT] || Keyboard.keys[Key.A] ) {
			inputVelocity.x += -Player.MOVE_SPEED;
		}
		if ( Keyboard.keys[Key.UP] || Keyboard.keys[Key.W] ) {
			inputVelocity.z += -Player.MOVE_SPEED;
		}
		if ( Keyboard.keys[Key.RIGHT] || Keyboard.keys[Key.D] ) {
			inputVelocity.x += +Player.MOVE_SPEED;
		}
		if ( Keyboard.keys[Key.DOWN] || Keyboard.keys[Key.S] ) {
			inputVelocity.z += +Player.MOVE_SPEED;
		}
		if ( Keyboard.keys[Key.R] ) {
			de&&bug.log( 'r pressed.' );
		}
		if ( Keyboard.keys[Key.F] ) {
			de&&bug.log( 'f pressed.' );
		}
		if ( Keyboard.keys[Key.SPACE] ) {
			de&&bug.log( 'space pressed.' );
		}
		if ( Keyboard.keys[Key.CTRL] ) {
			de&&bug.log( 'ctrl pressed.' );
		}

		// handle isMouseRightDown input from click or tap
		if ( isMouseRightDown &&
			 !( Keyboard.keys[Key.UP] || Keyboard.keys[Key.W] ||
				Keyboard.keys[Key.DOWN] || Keyboard.keys[Key.S] )
		   ) {

			inputVelocity.z += -Player.MOVE_SPEED;

		}

		// apply the euler angle quaternion to the velocity vector so we can add
		// 	the appropriate amount for each x and z component to translate
		inputVelocity.applyQuaternion( quat );
		eyeBody.velocity.x += inputVelocity.x * deltaTime;
		eyeBody.velocity.z += inputVelocity.z * deltaTime;

	}
	
	
	// handle mouse button and movement input
	function onDocumentMouseDown( e ) {

		e.preventDefault();
		e.stopPropagation();

		// make sure hud is hidden on every click
		hud.hide();

		// capture mouse movement on all mouse button downs except...
		// 	only raycast objects & rotate camera on mouse left button and
		// 	only move player in z on mouse right button 
		// track camera rotation on mouse swipes
		mouseXOnMouseDown = e.clientX - windowHalfX;
		mouseYOnMouseDown = e.clientY - windowHalfY;
		targetRotationOnMouseDownX = targetRotationX;
		targetRotationOnMouseDownY = targetRotationY;

		if ( e.button === Mouse.LEFT ) {

			// mouse x,y tracking for raytracer object intersection
			mouse.x = ( e.clientX / renderer.domElement.clientWidth )  * 2 - 1;
			mouse.y = -( e.clientY / renderer.domElement.clientHeight ) * 2 + 1;
			raycaster.setFromCamera( mouse, camera );
			// grab the first object we intersect if any and
			// only interact if the object's distance is close 
			let intersects = raycaster.intersectObjects( pickObjects );
			if ( intersects.length && intersects[0].distance < pickDistance ) {

				// compare intersected obj by each mesh id
				let id = intersects[0].object.uuid;

				// check doors
				for ( let i = 0; i < game.rooms[game.currRoom].doors.length; ++i ) {
					let door = game.rooms[game.currRoom].doors[i];
					if ( id === door.uuid ) {
						// open door only if it is already open (UX, easier to enter)
						if ( door.open ) {
							door.body.open();
						} else {
							door.handle.toggle();
						}
					}
				}

				// check notes for possible door opening events
				for ( let i = 0; i < notes.length; ++i ) {
					if ( id === notes[i].uuid ) {
						hud.show( notes[i].src );
						notes[i].read();

						// check if reading this note opens door
						let doors = game.rooms[game.currRoom].doors;
						for ( let j = 0; j < doors.length; ++j ) {
							doors[j].checkCanOpen();
						}
					}
				}

			}

			isMouseLeftDown = true;

		}

		if ( e.button === Mouse.RIGHT ) {

			isMouseRightDown = true;

		}

	}


	function onDocumentMouseMove( e ) {

		mouseX = e.clientX - windowHalfX;
		mouseY = e.clientY - windowHalfY;

		// only rotate camera on mouse left button hold
		if ( isMouseLeftDown ) {

			targetRotationX = targetRotationOnMouseDownX + ( mouseY - mouseYOnMouseDown ) * Player.ROTATE_OFFSET_DAMP;
			targetRotationY = targetRotationOnMouseDownY + ( mouseX - mouseXOnMouseDown ) * Player.ROTATE_OFFSET_DAMP;
			// rotation about x-axis should be max 90 deg
			if ( targetRotationX * THREE.Math.RAD2DEG > 90 ) {
				targetRotationX = 90 * THREE.Math.DEG2RAD;
			}
			if ( targetRotationX * THREE.Math.RAD2DEG < -90 ) {
				targetRotationX = -90 * THREE.Math.DEG2RAD;
			}

		}

		if ( isMouseRightDown ) {

		}

	}


	function onDocumentMouseUp( e ) {

		if ( e.button === Mouse.LEFT ) { isMouseLeftDown = false; }
		if ( e.button === Mouse.RIGHT ) { isMouseRightDown = false; }
		
	}


	function onDocumentTouchStart( e ) {
		
		// don't handle 3+ touches
		if ( e.touches.length > 2 ) { e.preventDefault(); e.stopPropagation(); return; }

		// simulate mousedown event for easier handling 
		e.clientX = e.touches[0].clientX;
		e.clientY = e.touches[0].clientY;
		if ( e.touches.length === 1 ) { e.button = Mouse.LEFT; }
		if ( e.touches.length === 2 ) { e.button = Mouse.RIGHT; }
		onDocumentMouseDown( e );
		
	}


	function onDocumentTouchMove( e ) {

		// simulate mousemove event for easier handling
		e.clientX = e.touches[0].clientX;
		e.clientY = e.touches[0].clientY;
		if ( e.touches.length === 1 ) { e.button = Mouse.LEFT; }
		if ( e.touches.length === 2 ) { e.button = Mouse.RIGHT; }
		onDocumentMouseMove( e );

	}


	function onDocumentTouchEnd( e ) {

		// don't handle 3+ touches
		if ( e.touches.length > 1 ) { e.preventDefault(); e.stopPropagation(); return; }

		if ( e.touches.length === 0 ) { isMouseLeftDown = false; }

		if ( e.touches.length === 1 ) {
			// reset rotation tracking to position of last touch on screen
			mouseXOnMouseDown = e.touches[0].clientX - windowHalfX;
			mouseYOnMouseDown = e.touches[0].clientY - windowHalfY;
			targetRotationOnMouseDownX = targetRotationX;
			targetRotationOnMouseDownY = targetRotationY;
			
			isMouseRightDown = false; 
		}

	}


	/*********************************************************
	 * initialize all enumerated types
	 *********************************************************
	 */
	function initEnums() {
		
		// init canvas to not take up so much space (scrollbars appear) 
		Canvas = {
			SIZE : 1 
		};

		// init game object and properties
		Game = {
			WRONG_ANSWER : -1,
			NO_ANSWER : 0,
			CORRECT_ANSWER : 1,
			NUM_ROOMS : 3
		};

		// init player properties
		Player = {
			MOVE_SPEED : 66,
			ROTATE_SPEED : 10,		// speed to reach desired rotation
			ROTATE_OFFSET_DAMP : 0.002	// offset sensitivity
		};

		// init keyboard input keycodes
		Key = {
			LEFT : 37,
			UP : 38,
			RIGHT : 39,
			DOWN : 40,
			A : 65,
			W : 87,
			D : 68,
			S : 83,
			R : 82,
			F : 70,
			SPACE : 32,
			CTRL : 17
		};

		// init handle keyboard input
		Keyboard = {
			keys : {},
			keyPress : function( e ) {
				// e.preventDefault();
				if ( this.keys[e.keyCode] > 0 ) { return; }
				this.keys[e.keyCode] = e.timeStamp || ( performance.now() );
				e.stopPropagation();
			},
			keyRelease : function( e ) {
				// e.preventDefault();
				this.keys[e.keyCode] = 0;
				e.stopPropagation();
			}
		};

		// init mouse clicks
		Mouse = {
			LEFT : 0,
			MIDDLE : 1,
			RIGHT : 2
		};

	}


	/*********************************************************
	 * helper functions
	 *********************************************************
	 */
	function onWindowResize() {

		// reset camera aspect ratio
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		// reset renderer scene size
		renderer.setSize( window.innerWidth * Canvas.SIZE, 
						  window.innerHeight * Canvas.SIZE 
						);

		// reset logic based on window size
		windowHalfX = window.innerWidth / 2;
		windowHalfY = window.innerHeight / 2;

		// re-center all hud imgs
		hud.resize();
		
	}


	// get .json object locally
	function XHR( file, callback ) {

		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function() {

			if ( xhr.readyState === 4 && xhr.status === 200 ) {
				callback( xhr.responseText );
			}

		}
		xhr.open( 'GET', file, true );
		xhr.send();

	}


	// create a door, door body, and door handle objects
	function createDoor( room, ops ) {

		let door, doorBody, doorHandle, dw = ops.doorWidth, dh = ops.doorHeight, dd = ops.doorDepth, df = ops.doorOffset, dm = ops.doorMass, dld = ops.doorLinearDamping, da = ops.doorAnswer,
		x = ops.doorPosition.x, y = ops.doorPosition.y, z = ops.doorPosition.z,
		rotx = ops.doorRotation.x, roty = ops.doorRotation.y, rotz = ops.doorRotation.z;
		let shape, rotation, quat;
		let hingeBotBody, hingeTopBody, hingeConstraint;
		let geometry, material, texture, mats = [];


		// setup door physics body in the scene (half extents)
		shape = new CANNON.Box( new CANNON.Vec3( (dw-df)/2, (dh-df)/2, dd/2 ) );
		doorBody = new CANNON.Body( { mass: dm, material: physicsMaterial } );
		// door body starts with a mass so physics knows it is initially a
		// 	moving body but it should start closed so let's freeze it via mass 0
		doorBody.mass = 0;
		doorBody.updateMassProperties();
		doorBody.linearDamping = dld;
		// set initial door body position
		doorBody.position.set( x, y + dh/2, z + dd/2 );
		// set initial door body rotation in x,y,z
		rotation = new CANNON.Quaternion( 0, 0, 0, 1 );
		quat = new CANNON.Quaternion( 0, 0, 0, 1 );
		quat.setFromAxisAngle( new CANNON.Vec3( 1, 0, 0 ), rotx*THREE.Math.DEG2RAD );
		rotation = rotation.mult( quat );
		quat = new CANNON.Quaternion( 0, 0, 0, 1 );
		quat.setFromAxisAngle( new CANNON.Vec3( 0, 1, 0 ), roty*THREE.Math.DEG2RAD );
		rotation = rotation.mult( quat );
		quat = new CANNON.Quaternion( 0, 0, 0, 1 );
		quat.setFromAxisAngle( new CANNON.Vec3( 0, 0, 1 ), rotz*THREE.Math.DEG2RAD );
		rotation = rotation.mult( quat );
		doorBody.quaternion = doorBody.quaternion.mult( rotation );
		// add door body to world
		doorBody.addShape( shape );
		world.addBody( doorBody );
		// create bottom hinge constraint on door
		hingeBotBody = new CANNON.Body( { mass: 0 } );
		// hingeBody must match position of doorBody!
		hingeBotBody.position.set( x, y + dh/2, z );
		hingeBotBody.quaternion = hingeBotBody.quaternion.mult( rotation );
		// note that pivotA & pivotB offsets should be the same if hingeBody
		// 	position is not specified. we are basically specifying the offset
		// 	of where the rotation axis is locally from bodyB (doorBody)
		// axis should also be the same
		hingeConstraint = new CANNON.HingeConstraint( hingeBotBody, doorBody, {
			pivotA: new CANNON.Vec3( -dw/2, -dh/2, dd/2 ), // pivot offsets should be same 
			axisA: new CANNON.Vec3( 0, 1, 0 ), // axis offsets should be same 
			pivotB: new CANNON.Vec3( -dw/2, -dh/2, dd/2 ), // pivot offsets should be same
			axisB: new CANNON.Vec3( 0, 1, 0 ) // axis offsets should be same
		} );
		world.addConstraint( hingeConstraint );
		// create top hinge constraint on door
		hingeTopBody = new CANNON.Body( { mass: 0 } );
		hingeTopBody.position.set( x, y + dh/2, z );
		hingeTopBody.quaternion = hingeTopBody.quaternion.mult( rotation );
		hingeConstraint = new CANNON.HingeConstraint( hingeTopBody, doorBody, {
			pivotA: new CANNON.Vec3( -dw/2, +dh/2, dd/2 ), // pivot offsets should be same 
			axisA: new CANNON.Vec3( 0, 1, 0 ), // axis offsets should be same 
			pivotB: new CANNON.Vec3( -dw/2, +dh/2, dd/2 ), // pivot offsets should be same
			axisB: new CANNON.Vec3( 0, 1, 0 ) // axis offsets should be same
		} );
		world.addConstraint( hingeConstraint );
		

		// create door as a textured box mesh
		geometry = new THREE.BoxGeometry( dw-df, dh-df, dd );
		// texture door sides
		texture = new THREE.TextureLoader().load( ops.doorFaceSideTexture );
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( 1, 1 );
        mats.push(new THREE.MeshBasicMaterial( { map: texture } ) );
        mats.push(new THREE.MeshBasicMaterial( { map: texture } ) );
        mats.push(new THREE.MeshBasicMaterial( { map: texture } ) );
        mats.push(new THREE.MeshBasicMaterial( { map: texture } ) );
		// texture door front & back
		texture = new THREE.TextureLoader().load( ops.doorFaceFrontTexture );
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( 1, 1 );
        mats.push(new THREE.MeshBasicMaterial( { map: texture } ) );
        mats.push(new THREE.MeshBasicMaterial( { map: texture } ) );
		// put all mats together and create door
        material = new THREE.MeshFaceMaterial( mats );
		door = new THREE.Mesh( geometry, material );
		scene.add( door );
		pickObjects.push( door );
		// add open function to door (via door body)
		initDoor( door, da, doorBody, dm, ops.doorOpenFunc, dw, dh, dd, x, y, z );

		// create door handle via asynchronous load json file
		XHR( ops.doorHandleModel, function( data ) {
			// load door handle obj group (will be stuck to door)
			doorHandle = JSON.parse( data );
			doorHandle = (new THREE.ObjectLoader()).parse( doorHandle );
			// setup door handle texture (from shiny metallic texture)
			texture = new THREE.TextureLoader().load( ops.doorHandleTexture );
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.repeat.set( 1, 1 );
			// add texture to door handle obj group (from .json loader)
			doorHandle.children[0].material = new THREE.MeshBasicMaterial( { map: texture } )
			// stick door handle appropriately on door
			doorHandle.position.set( x + 0.41*dw, y + -0.06*dh, 0 );
			door.add( doorHandle );
			// add update and toggle functions to door handle
			initDoorHandle( door, doorHandle );

			// increment another loaded door handle model and signal that all
			//	models are loaded so gameloop can start taking input/updating
			room.modelsLoaded++;
			if ( room.modelsLoaded === room.NUM_DOORS ) {
				room.allModelsLoaded = true;
			}
		} );


		return door;
	}


	// toggle door body impulse (and change door mass so it can be opened)
	function initDoor( dr, da, drb, dm, drOpenFunc, dw, dh, dd, dx, dy, dz ) {
		let impulseForce, worldPoint;

		// check if door and door body defined
		if ( !dr && !da && !drb && !drOpenFunc ) {
			de&&bug.log( 'initDoor() error: door or door body undefined.' );
		}

		// check for existing props
		if ( dr.body || dr.answer || dr.open || drb.open || dr.checkCanOpen ||
			dr.dim || dr.pos ) {
			de&&bug.log( 'initDoor() error: an existing door body prop was overwritten' );
		}

		// attach door body to door
		dr.body = drb;
		// has this door been opened yet?
		dr.open = false;
		// is this the correct door to exit?
		dr.answer = da;
		// set initial door dimension and position (used in wall door calculation)
		dr.dim = { w: dw, h: dh, d: dd };
		dr.pos = { x: dx, y: dy, z: dz };

		// open function will change door body's mass and open it via impulse
		drb.open = function( openForce ) {
			// check acting force on door body exists
			if ( !openForce ) {
				openForce = 100;
			}
			// toggle mass so door is movable
			drb.mass = dm;
			drb.updateMassProperties();
			// apply impulse force on door
			impulseForce = new CANNON.Vec3( 0, 0, openForce );
			worldPoint = new CANNON.Vec3( drb.position.x,
										  drb.position.y,
										  drb.position.z
										);
			drb.applyImpulse( impulseForce, worldPoint );
			// toggle door handle whenever door opens
			dr.handle.toggle();
			// set this door to open when clicked
			dr.open = true;
		};

		// test whether conditions are met for door to open
		dr.checkCanOpen = drOpenFunc.bind( dr );
		
	}


	// toggle door handle
	function initDoorHandle( dr, dh ) {

		// error check that door and door handle defined
		if ( !dr && !dh ) {
			de&&bug.log( 'initDoorHandle() error: door or door handle undefined.' );
		}

		// error check if any of the new created props already exist
		if ( dr.handle || dh.animating || dh.update || dh.toggle ) {
			de&&bug.log( 'initDoorHandle() error: an existing door/doorHandle prop was overwritten.' );
		}

		// attach door to handle
		dr.handle = dh;

		// init door handle properties
		dh.animating = false;

		// update function called on each frame
		dh.update = function() {
			if ( dh.animating ) {
				if ( dh.rotation.z*THREE.Math.RAD2DEG < 1 ) {
					dh.rotateZ( Math.PI/2 );
				} else {
					dh.rotateZ( -1*THREE.Math.DEG2RAD );
					if ( dh.rotation.z*THREE.Math.RAD2DEG < 1 ) {
						dh.animating = false;
					}
				}
			}
		};

		// toggle door handle animation
		dh.toggle = function() {
			if ( !dh.animating ) {
				dh.animating = true;
			}
		};

	}


	// create walls
	function createWall( ops ) {
		
		let wallBody, wall, ww = ops.wallWidth, wh = ops.wallHeight,
		wd = ops.wallDepth, wm = ops.wallMass,
		x = ops.wallPosition.x, y = ops.wallPosition.y, z = ops.wallPosition.z,
		rotx = ops.wallRotation.x, roty = ops.wallRotation.y, rotz = ops.wallRotation.z;
		let shape, rotation, quat;
		let geometry, material, texture, mats = [];
				
		let doors = ops.wallDoors;

		// create wall with or without doors?
		if ( doors.length ) {

			let wallT, wallL, wallR;

			// the complete wall body and mesh
			wallBody = new CANNON.Body( { mass: wm } );
			wall = new THREE.Mesh();

			for ( let i = 0; i < doors.length; ++i ) {

				// doors must be in ascending x order for proper wall creation
				if ( doors[i+1] && doors[i].pos.x > doors[i+1].pos.x ) {
					de&&bug.log( 'createWall() error: doors must be in ascending x order' );
				}

				let dr = doors[i];
				let dw = dr.dim.w, dh = dr.dim.h, dd = dr.dim.d;
				let x = dr.pos.x; // this door's x value
				let px = ( doors[i-1] )? doors[i-1].pos.x : ww/2; // prev door's x value
				let lww = (abs(x - px) - dw/2); // left wall width


				// wallDoor left box mesh (half extents)
				shape = new CANNON.Box( new CANNON.Vec3( lww/2, wh/2, wd/2 ) );
				wallBody.addShape( shape, new CANNON.Vec3( -px + lww/2, wh/2, 0 ) );
				// wallDoor top box mesh (half extents)
				shape = new CANNON.Box( new CANNON.Vec3( dw/2, (wh-dh)/2, wd/2 ) );
				wallBody.addShape( shape, new CANNON.Vec3( x, ((wh-dh)/2)+dh, 0 ) );
				
				// create the wall door parts separately and add them to the
				// 	complete wall
				// create left part of wall door mesh (left of door, full extents)
				// get previous x position if it exists
				geometry = new THREE.BoxGeometry( lww, wh, wd );
				mats = [];
				texture = new THREE.TextureLoader().load( ops.wallTexture );
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.repeat.set( wd*2/ww, dh/wh );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				texture = new THREE.TextureLoader().load( ops.wallTexture );
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.repeat.set( lww*2/ww, 1 );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				material = new THREE.MeshFaceMaterial( mats );
				wallL = new THREE.Mesh( geometry, material );
				wallL.position.set( -px + lww/2, wh/2, 0 );
				wall.add( wallL );
				// create top part of wall door mesh (above door, full extents)
				geometry = new THREE.BoxGeometry( dw, wh-dh, wd );
				mats = [];
				texture = new THREE.TextureLoader().load( ops.wallTexture );
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.repeat.set( dw*2/ww, dd/wh );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				texture = new THREE.TextureLoader().load( ops.wallTexture );
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.repeat.set( dw*2/ww, (dh-wh)/wh );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				material = new THREE.MeshFaceMaterial( mats );
				wallT = new THREE.Mesh( geometry, material );
				wallT.position.set( x, ((wh-dh)/2)+dh, 0 );
				wall.add( wallT );

			}

			// // wallDoor right box body (right of last door, half extents)
			// shape = new CANNON.Box( new CANNON.Vec3( lww/2, wh/2, wd/2 ) );
			// wallBody.addShape( shape, new CANNON.Vec3( +((ww-dw)/4)+dw/2, wh/2, 0 ) );
			// // create right part of wallDoor mesh (right of last door, full extents)
			// wallR = new THREE.Mesh( geometry, material );
			// wallR.position.set( ((ww-dw)/4)+dw/2, wh/2, 0 );
			// wall.add( wallR );

		} else {

			// create wall physics body
			shape = new CANNON.Box( new CANNON.Vec3( ww/2, wh/2, wd/2 ) );
			wallBody = new CANNON.Body( { mass: wm } );
			wallBody.addShape( shape );
			// set initial position of wall
			wallBody.position.set( x, y + wh/2, z );
			// set initial rotation of wall
			rotation = new CANNON.Quaternion( 0, 0, 0, 1 );
			quat = new CANNON.Quaternion( 0, 0, 0, 1 );
			quat.setFromAxisAngle( new CANNON.Vec3( 1, 0, 0 ), rotx*THREE.Math.DEG2RAD );
			rotation = rotation.mult( quat );
			quat = new CANNON.Quaternion( 0, 0, 0, 1 );
			quat.setFromAxisAngle( new CANNON.Vec3( 0, 1, 0 ), roty*THREE.Math.DEG2RAD );
			rotation = rotation.mult( quat );
			quat = new CANNON.Quaternion( 0, 0, 0, 1 );
			quat.setFromAxisAngle( new CANNON.Vec3( 0, 0, 1 ), rotz*THREE.Math.DEG2RAD );
			rotation = rotation.mult( quat );
			wallBody.quaternion = wallBody.quaternion.mult( rotation );

			// create wall mesh
			geometry = new THREE.BoxGeometry( ww, wh, wd );
			// create full wall textures
			texture = new THREE.TextureLoader().load( ops.wallTexture );
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.repeat.set( 2, 1 );
			material = new THREE.MeshBasicMaterial( { map: texture } );
			wall = new THREE.Mesh( geometry, material );
			
		}

		// add the completed wall to the scene and attach body to mesh
		world.addBody( wallBody );
		scene.add( wall );
		initWall( wall, wallBody );


		return wall;

	}

	// init wall
	function initWall( wall, wallBody ) {
		
		// check if args defined
		if ( !wall && !wallBody ) {
			de&&bug.log( 'initWall() error: some args are undefined.' );
		}

		// check if overwriting existing properties
		if ( wall.body ) {
			de&&bug.log( 'initWall() error: an existing prop was overwritten.' );
		}

		wall.body = wallBody;

	}


	// init all notes
	function initNote( note, noteFile ) {

		// check if note or noteFile defined
		if ( !note || !noteFile ) {
			de&&bug.log( 'initNote() error: note / noteFile is undefined' );
		}

		// check if overwriting existing property
		if ( note.src || note.read ) {
			de&&bug.log( 'initNote() error: existing note prop was overwritten.' );
		}

		let alreadyRead = false;
		note.src = noteFile;

		note.read = function() {
			if ( !alreadyRead ) {
				alreadyRead = true;
				readCount++;
			}
		};

	}


	// init hud that shows all hud imgs in game
	function initHUD( hud, base ) {

		// check if hud defined
		if ( !hud && !base ) {
			de&&bug.log( 'initHUD() error: hud / base is not defined.' );
		}

		// check if overwriting existing hud properties
		if ( hud.resize || hud.onload || hud.show || hud.hide ) {
			de&&bug.log( 'initHUD() error: existing hud prop was overwritten.' );
		}

		// set hud styled centered on screen with a opacity fade
		hud.style.cssText = 'max-width: 100vw; max-height: 100vh; position: fixed; z-index: 200; opacity: 0; transition: opacity 0.5s';

		// re-center all hud imgs
		hud.resize = function() {
			hud.style.top = (((window.innerHeight - hud.height ) / 2) >> 0) + 'px';
			hud.style.left = (((window.innerWidth - hud.width) / 2) >> 0) + 'px';
		};

		// set the top and left offsets once hud img is loaded
		hud.onload = function( e ) {
			hud.resize();
			hud.style.opacity = 1;
		};

		// show a new hud img
		hud.show = function( src, options ) {
			hud.src = base + src;
			let w = options && options.width? options.width : 'auto';
			let h = options && options.height? options.height : 'auto';
			hud.style.width = w;
			hud.style.height = h;
			// dim background when showing something on hud
			dimmer.style.opacity = 0.8;
		};

		// hide currently displayed hud img
		hud.hide = function() {
			hud.style.opacity = 0;
			// undim background
			dimmer.style.opacity = 0;
		};

	}


	// return the absolute value of a number
	function abs( n ) {
		return ( n < 0 )? -n : n;
	}



}( window.witchr = window.witchr || {} ));