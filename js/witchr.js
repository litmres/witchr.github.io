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
	let physicsMaterial;
	
	// three.js
	let camera, scene, renderer, raycaster, mouse, pickDistance = 6;
	let floor;
	let pickObjects;

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
		document.addEventListener( 'mouseover', onDocumentMouseMove, false);
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
		
		
	}


	// init global threejs logic, not including room specific stuff
	function initThree() {
		
		pickObjects = [];
		let geometry, material, texture, mats = [];

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


	}


	// initialize all game objects such as the rooms, doors, walls, notes
	function initGame() {

		// window.cancelAnimationFrame( game.stopGameLoop ) can be called to stopGameLoop
		// 	the main requestAnimationFrame() loop
		game.stopGameLoop = 0;
		// start game on it's initial room
		game.currRoom = 0;
		// setup the player
		game.player = createPlayer( { eyeRadius: 3, eyeMass: 10, eyeLinearDamping: 0.99, eyeOpacity: 0.1, eyeStartPos: { x: 0, y: 0, z: 25 } } );
		// setup each room in the game, each room contains doors, walls, and notes
		let rD, roomsData;
		rD = roomsData = [
			/**
			8888888b.                                       .d8888b.  
			888   Y88b                                     d88P  Y88b 
			888    888                                     888    888 
			888   d88P  .d88b.   .d88b.  88888b.d88b.      888    888 
			8888888P"  d88""88b d88""88b 888 "888 "88b     888    888 
			888 T88b   888  888 888  888 888  888  888     888    888 
			888  T88b  Y88..88P Y88..88P 888  888  888     Y88b  d88P 
			888   T88b  "Y88P"   "Y88P"  888  888  888      "Y8888P"  
			*/
			{	
				doorsData: [
					{ dw: 8, dh: 11, dd: 0.5, df: 0.5, dm: 10, dld: 0.66, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0,
					answer: Game.CORRECT_ANSWER,
					frontTexture: './img/door_face_front-min.jpg',
					sideTexture: './img/door_face_side-min.jpg',
					handleModel: './model/door_handle.json',
					handleTexture: './img/door_handle-min.jpg' },
					{ dw: 8, dh: 11, dd: 0.5, df: 0.5, dm: 10, dld: 0.66, x: 20, y: 0, z: 0, rx: 0, ry: 0, rz: 0,
					answer: Game.WRONG_ANSWER,
					frontTexture: './img/door_face_front-min.jpg',
					sideTexture: './img/door_face_side-min.jpg',
					handleModel: './model/door_handle.json',
					handleTexture: './img/door_handle-min.jpg' }
				],
				wallsData: [
					{ w: 50, h: 20, d: 1, m: 0, x: 0, y: 0, z: 0, rX: 0, rY: 0, rZ: 0,
						getDoors: function( room ) { return [room.doors[0], room.doors[1]]; },
						wallTexture: './img/wallpaper-min.jpg' },
					{ w: 50, h: 20, d: 1, m: 0, x: 25, y: 0, z: 25, rX: 0, rY: 90, rZ: 0,
						getDoors: function( room ) { return []; },
						wallTexture: './img/wallpaper-min.jpg' },
					{ w: 50, h: 20, d: 1, m: 0, x: 0, y: 0, z: 50, rX: 0, rY: 0, rZ: 0,
						getDoors: function( room ) { return []; },
						wallTexture: './img/wallpaper-min.jpg' },
					{ w: 50, h: 20, d: 1, m: 0, x: -25, y: 0, z: 25, rX: 0, rY: 90, rZ: 0,
						getDoors: function( room ) { return []; },
						wallTexture: './img/wallpaper-min.jpg' },
				],
				notesData: [ 
					{ w: 5, h: 3, d: 0.001, x: -15, y: 8, z: 49, rX: 0, rY: 0, rZ: 0,
						fileName: 'note1.png' },
					{ w: 3, h: 5, d: 0.001, x: 0, y: 8, z: 49, rX: 0, rY: 0, rZ: 0,
						fileName: 'note2.png' },
					{ w: 11, h: 11, d: 0.001, x: +15, y: 8, z: 49, rX: 0, rY: 0, rZ: 0,
						fileName: 'news-min.jpg' },
				],
				checkExitConditionFunc: function() {
					// generally, best way to do this is to check for the closest door
					//	to the player on exit and grab the ca/wa from that door.
					// test against exit condition
					let room = this;
					if ( game.player.position.z < 0 ) {
						// get the closest door to player
						let closest = { door: room.doors[0], d: game.player.position.distanceTo( room.doors[0].position ) };
						for ( let i = 1; i < room.doors.length; ++i ) {
							let dist = game.player.position.distanceTo( room.doors[i].position );
							closest = ( closest.d < dist )? closest : { door: room.doors[i], d: dist };
						}
						// set the room state to the closest door's answer
						room.state = closest.door.answer;
					}
				},
				winFunc: function() {
					hud.show( 'end-min.jpg', { width: '100vw', height: '100vh' } );
				},
				loseFunc: function() {
					console.log( 'YOU LOSE!!!!' );
				}
			},
			/**
			8888888b.                                       d888   
			888   Y88b                                     d8888   
			888    888                                       888   
			888   d88P  .d88b.   .d88b.  88888b.d88b.        888   
			8888888P"  d88""88b d88""88b 888 "888 "88b       888   
			888 T88b   888  888 888  888 888  888  888       888   
			888  T88b  Y88..88P Y88..88P 888  888  888       888   
			888   T88b  "Y88P"   "Y88P"  888  888  888     8888888 
			*/
		];
		game.NUM_ROOMS = rD.length;
		game.rooms = [];
		for ( let r = 0; r < game.NUM_ROOMS; ++r ) {

			let room = {};
			let dD = rD[r].doorsData;
			room = {};
			room.state = Game.NO_ANSWER;
			// create doors
			room.modelsLoaded = 0;
			room.allModelsLoaded = false;
			room.NUM_DOORS = dD.length;
			room.doors = [];
			for ( let i = 0; i < room.NUM_DOORS; ++i ) {
				room.doors.push( createDoor( room, {
						doorWidth: dD[i].dw, doorHeight: dD[i].dh, doorDepth: dD[i].dd,
						doorOffset: dD[i].df, doorMass: dD[i].dm, doorLinearDamping: dD[i].dld,
						doorPosition: { x : dD[i].x, y : dD[i].y, z : dD[i].z },
						doorRotation: { x: dD[i].rx, y: dD[i].ry, z: dD[i].rz },
						doorAnswer: dD[i].answer,
						doorFaceFrontTexture: dD[i].frontTexture,
						doorFaceSideTexture: dD[i].sideTexture,
						doorHandleModel: dD[i].handleModel,
						doorHandleTexture:dD[i].handleTexture 
				} ) );
			}
			// create walls
			let wD = rD[r].wallsData;
			room.NUM_WALLS = wD.length;
			room.walls = [];
			for ( let i = 0; i < room.NUM_WALLS; ++i ) {
				room.walls.push( createWall( room, {
						wallWidth: wD[i].w, wallHeight: wD[i].h, wallDepth: wD[i].d,
						wallPosition: { x: wD[i].x, y: wD[i].y, z: wD[i].z },
						wallRotation: { x: wD[i].rX, y: wD[i].rY, z: wD[i].rZ },
						wallMass: wD[i].m,
						getWallDoors: wD[i].getDoors,
						wallTexture: wD[i].wallTexture 
				} ) );
			}
			// create notes
			let nD = rD[r].notesData;
			room.NUM_NOTES = nD.length;
			room.notes = []
			room.readCount = 0;
			for ( let i = 0; i < room.NUM_NOTES; ++i ) {
				room.notes.push( createNote( room, {
						noteWidth: nD[i].w, noteHeight: nD[i].h, noteDepth: nD[i].d,
						x: nD[i].x, y: nD[i].y, z: nD[i].z,
						rX: nD[i].rX, rY: nD[i].rY, rZ: nD[i].rZ,
						fileName: nD[i].fileName
				} ) );
			}
			// check if player has exited room through a door
			room.checkExitCondition = rD[r].checkExitConditionFunc;
			room.checkExitCondition.bind( room );
			// win and exit room
			room.win = rD[r].winFunc;
			room.win.bind( room );
			// lose room logic
			room.lose = rD[r].loseFunc;
			room.lose.bind( room );
			// add this room to the array of game rooms
			game.rooms.push( room );
		}

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

		let player = game.player;
		let room = game.rooms[game.currRoom];
		let rotation;


		world.step( dt );


		// reset player quaternion so we always rotate offset from origin
		player.body.quaternion.set( 0, 0, 0, 1 );
		// local rotation about the y-axis
		rotation = new CANNON.Quaternion( 0, 0, 0, 1 );
		rotation.setFromAxisAngle( new CANNON.Vec3( 0, 1, 0 ), rotY );
		player.body.quaternion = player.body.quaternion.mult( rotation );
		rotation = new CANNON.Quaternion( 0, 0, 0, 1 );
		rotation.setFromAxisAngle( new CANNON.Vec3( 1, 0, 0 ), rotX );
		player.body.quaternion = player.body.quaternion.mult( rotation );


		// update all of meshes to their physics bodies
		player.position.copy( player.body.position );
		player.quaternion.copy( player.body.quaternion );

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

		let inputVelocity, euler, quat;

		// get the rotation offset values from mouse and touch input
		rotX += ( targetRotationX - rotX ) * Player.ROTATE_SPEED * deltaTime;
		rotY += ( targetRotationY - rotY ) * Player.ROTATE_SPEED * deltaTime;

		// get the input velocity for translation, euler angle that describes
		// 	the current rotation transformation and quaternion to apply the
		// 	euler angle transform to the input vector
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
		game.player.body.velocity.x += inputVelocity.x * deltaTime;
		game.player.body.velocity.z += inputVelocity.z * deltaTime;

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
				for ( let i = 0; i < game.rooms[game.currRoom].notes.length; ++i ) {
					let note = game.rooms[game.currRoom].notes[i];
					if ( id === note.uuid ) {
						hud.show( note.src );
						note.read();
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
			CORRECT_ANSWER : 1
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


	// create player from camera eye
	function createPlayer( ops ) {

		let eye, eyeBody, er = ops.eyeRadius, em = ops.eyeMass, eld = ops.eyeLinearDamping, eo = ops.eyeOpacity, x = ops.eyeStartPos.x, y = ops.eyeStartPos.y, z = ops.eyeStartPos.z;
		let shape, rotation, quat;
		let geometry, material;

		// setup eye physics body that simulates and positions player
		shape = new CANNON.Sphere( er );
		eyeBody = new CANNON.Body( { mass: em, material: physicsMaterial } );
		eyeBody.addShape( shape );
		eyeBody.linearDamping = eld;
		// init position
		eyeBody.position.set( x, y + er, z );
		// local rotation is determined by mouse position so no need to set
		// add body to world
		world.addBody( eyeBody );

		// create eye mesh to render eye body for troubleshooting
		geometry = new THREE.SphereGeometry( er, 16, 16 );
		material = new THREE.MeshBasicMaterial( { color: 0xff0000, 
												  wireframe: true, 
												  transparent: true, 
												  opacity: eo 
											  } );
		eye = new THREE.Mesh( geometry, material );
		scene.add( eye );
		camera.position.copy( eye.position );
		// place camera at the very top of eye mesh
		camera.position.y += er;
		eye.add( camera );
		initEye( eye, eyeBody );
		
		return eye;

	}


	// initialize the player's eye
	function initEye( e, eb ) {

		// check args defined
		if ( !e && !eb ) {
			de&&bug.log( 'initEye() error: some arg is not defined.' );
		}

		// check if overwriting an existing property
		if ( e.body ) {
			de&&bug.log( 'initEye() error: an existing prop was overwritten.' );
		}

		// attach physics body to mesh
		e.body = eb;
		
	}


	// create a door, door body, and door handle objects
	function createDoor( room, ops ) {

		let door, doorBody, doorHandle, dw = ops.doorWidth, dh = ops.doorHeight, dd = ops.doorDepth, df = ops.doorOffset, dm = ops.doorMass, dld = ops.doorLinearDamping, da = ops.doorAnswer,
		x = ops.doorPosition.x, y = ops.doorPosition.y, z = ops.doorPosition.z,
		rotx = ops.doorRotation.x, roty = ops.doorRotation.y, rotz = ops.doorRotation.z;
		let answer = ops.doorAnswer;
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
		initDoor( door, da, doorBody, dm, dw, dh, dd, x, y, z, answer );

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
			doorHandle.position.set( dw*0.41, dh*-0.06, 0 );
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
	function initDoor( dr, da, drb, dm, dw, dh, dd, dx, dy, dz, answer ) {
		let impulseForce, worldPoint;

		// check if door and door body defined
		if ( !dr && !da && !drb ) {
			de&&bug.log( 'initDoor() error: some arg is undefined.' );
		}

		// check for existing props
		if ( dr.body || dr.answer || dr.open || drb.open || dr.dim || dr.pos,
			dr.answer ) {
			de&&bug.log( 'initDoor() error: an existing prop was overwritten' );
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
		// set the answer to this door on exit
		dr.answer = answer;

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
	function createWall( room, ops ) {
		
		let wallBody, wall, ww = ops.wallWidth, wh = ops.wallHeight,
		wd = ops.wallDepth, wm = ops.wallMass,
		x = ops.wallPosition.x, y = ops.wallPosition.y, z = ops.wallPosition.z,
		rotx = ops.wallRotation.x, roty = ops.wallRotation.y, rotz = ops.wallRotation.z;
		let shape, rotation, quat;
		let geometry, material, texture, mats = [];
		let doors = ops.getWallDoors( room );

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
				let pdw = ( doors[i-1] )? doors[i-1].dim.w : 0; // prev door's width
				let x = dr.pos.x; // this door's x value
				let px = ( doors[i-1] )? doors[i-1].pos.x : -ww/2; // prev door's x value
				let lww = abs(x - px) -dw/2 -pdw/2; // left wall width


				// create the wall door parts separately and add them to the
				// 	complete wall
				// wallDoor left box mesh (half extents)
				shape = new CANNON.Box( new CANNON.Vec3( lww/2, wh/2, wd/2 ) );
				wallBody.addShape( shape, new CANNON.Vec3( px +lww/2 +pdw/2, wh/2, 0 ) );
				// create left part of wall door mesh (left of door, full extents)
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
				wallL.position.set( px +lww/2 +pdw/2, wh/2, 0 );
				wall.add( wallL );

				// wallDoor top box mesh (half extents)
				shape = new CANNON.Box( new CANNON.Vec3( dw/2, (wh-dh)/2, wd/2 ) );
				wallBody.addShape( shape, new CANNON.Vec3( x, ((wh-dh)/2)+dh, 0 ) );
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

			let dr = doors[doors.length-1];
			let dw = dr.dim.w, dh = dr.dim.h, dd = dr.dim.d; // last door's dimensions
			let pdw = dw; // prev door's width is the last door's width
			let x = ww/2; // x is now at the very edge of the wall
			let px = doors[doors.length-1].pos.x; // prev door's x value
			let rww = abs(x - px) -pdw/2; // right wall width

			// wallDoor left box mesh (half extents)
			shape = new CANNON.Box( new CANNON.Vec3( rww/2, wh/2, wd/2 ) );
			wallBody.addShape( shape, new CANNON.Vec3( px +rww/2 +pdw/2, wh/2, 0 ) );
			// create left part of wall door mesh (left of door, full extents)
			geometry = new THREE.BoxGeometry( rww, wh, wd );
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
			texture.repeat.set( rww*2/ww, 1 );
			mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
			mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
			material = new THREE.MeshFaceMaterial( mats );
			wallL = new THREE.Mesh( geometry, material );
			wallL.position.set( px +rww/2 +pdw/2, wh/2, 0 );
			wall.add( wallL );

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


	// create notes
	function createNote( room, ops ) {

		let note, nw = ops.noteWidth, nh = ops.noteHeight, nd = ops.noteDepth,
		x = ops.x, y = ops.y, z = ops.z, rotx = ops.rX, roty = ops.rY, rotz = ops.rZ,
		fileName = ops.fileName;
		let geometry, material, texture;

		// create notes that will be spread all over room
		geometry = new THREE.BoxGeometry( nw, nh, nd );
		// create texture for each note
		texture = new THREE.TextureLoader().load( base + fileName );
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( 1, 1 );
		material = new THREE.MeshBasicMaterial( { map: texture, alphaTest: 0.5 } );
		note = new THREE.Mesh( geometry, material );
		// set note position
		note.position.set( x, y, z );
		// set note rotation
		note.rotateX( rotx );
		note.rotateY( roty );
		note.rotateZ( rotz );
		// init note and add it to scene
		initNote( note, fileName, room );
		scene.add( note );
		pickObjects.push( note );
 

		return note;

	}


	// init all notes
	function initNote( note, noteFile, room ) {

		// check if note or noteFile defined
		if ( !note || !noteFile || !room ) {
			de&&bug.log( 'initNote() error: some arg is undefined' );
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
				room.readCount++;
			}

			// if all notes read, open all doors
			if ( room.readCount === room.NUM_NOTES ) {
				for ( let i = 0; i < room.doors.length; ++i ) {
					room.doors[i].body.open();
				}
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
		if ( hud.resize || hud.onload || hud.show || hud.hide || hud.transitioning ) {
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

		// show a new hud img if not already transitioning
		hud.show = function( src, options ) {
			if ( hud.transitioning ) { return; }
			hud.transitioning = true;
			// display hud dom element (display: none when opacity 0)
			hud.style.display = 'block';
			hud.src = base + src;
			let w = options && options.width? options.width : 'auto';
			let h = options && options.height? options.height : 'auto';
			hud.style.width = w;
			hud.style.height = h;
			// dim background when showing something on hud
			dimmer.style.opacity = 0.8;
		};

		// hide currently displayed hud img if not already transitioning
		hud.hide = function() {
			if ( hud.transitioning || hud.style.opacity === '0' ) { return; }
			hud.transitioning = true;
			hud.style.opacity = 0;
			// undim background
			dimmer.style.opacity = 0;
		};

		// add a flag so hud cannot be stopped while it is transitioning
		hud.transitioning = false;
		hud.addEventListener( 'transitionend', function( e ) {
			hud.transitioning = false;
			// do not display hud dom element if opacity is 0
			if ( e.propertyName === 'opacity' && e.srcElement.style.opacity === '0' ) {
				e.srcElement.style.display = 'none';
			}
		});

	}


	// return the absolute value of a number
	function abs( n ) {
		return ( n < 0 )? -n : n;
	}



}( window.witchr = window.witchr || {} ));