/**
 * @fileoverview witchr 48 hour game jam for orcajam 2016. 
 * @author @superafable
 */


'use strict';



(function( witchr, undefined ) {

	// debugging toggle
	let de = true;
	let bug = console;
	
	// game and room stage logic
	let game = {};

	// fps stats
	let stats;

	// enums
	let Canvas, Game, Player, Key, Keyboard, Mouse;

	// hud and dimmer
	let hud, base = './img/', dimmer, transitionLength = '0.5s';

	// cannon.js
	let world, physicsMaterial, worldFriction = 0.0, worldRestitution = 0.0;
	let t = 0, dt = 1/240, newTime, frameTime, currTime = performance.now(), accumulator = 0;
	
	// three.js
	let camera, scene, renderer;
	let raycaster, mouse, pickObjects = [], pickDistance = 6;

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


	document.onload = init();


	/*********************************************************
	 * initialize scene 
	 *********************************************************
	 */
	function init() {

		// init constants
		initEnums();
		// init hud and show splash screen as the intro img
		initHUD();
		hud.show( 'splash-min.jpg', { width: '100vw', height: '100vh' } );
		// setup world
		initCannon();
		// setup camera, scene, renderer, raycaster
		initThree();
		// init game and room specific bodies, meshes, and logic
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


		document.addEventListener( 'click', function( e ) {
			game.openDoors();
		});


		// start an rAF for the gameloop
		requestAnimationFrame( gameloop );

	}

	
	// init global cannonjs logic, not including room specific stuff
	function initCannon() {

		let physicsContactMaterial;

		// setup world of physics
		world = new CANNON.World();
		world.broadphase = new CANNON.NaiveBroadphase();
		world.solver.iterations = 1;
		world.gravity.set( 0, -10, 0 );

		// create slippery/bouncy material for object contact friction/restitution
		physicsMaterial = new CANNON.Material( 'worldMaterial' );
		physicsContactMaterial = new CANNON.ContactMaterial( physicsMaterial, 
															 physicsMaterial, 
														   { friction: worldFriction,
															 restitution:worldRestitution 
														   } );
		world.addContactMaterial( physicsContactMaterial );

	}


	// init global threejs logic, not including room specific stuff
	function initThree() {
		
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
		
		// init renderer
		renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.setSize( window.innerWidth * Canvas.SIZE, 
						  window.innerHeight * Canvas.SIZE
						);
		renderer.setClearColor( 0x000000 );
		document.body.appendChild( renderer.domElement );

		// raycaster used in picking objects
		raycaster = new THREE.Raycaster();
		mouse = new THREE.Vector2();

	}


	// initialize all game objects such as the rooms, doors, walls, notes
	function initGame() {

		// window.cancelAnimationFrame( game.stopGameLoop ) can be called to stopGameLoop
		// 	the main requestAnimationFrame() loop
		game.stopGameLoop = 0;
		// lock input logic
		game.inputLocked = false;
		game.lockInput = function() { game.inputLocked = true; };
		game.unlockInput = function() { game.inputLocked = false; };
		// setup the player
		game.player = createPlayer( { eyeRadius: 3, eyeMass: 10, eyeLinearDamping: 0.99, eyeOpacity: 0.1, eyeStartPos: { x: 0, y: 0, z: 25 } } );
		// start game on it's initial room
		game.currRoom = 0;
		// game begins each room's reset logic and then rooms's run their own reset logic
		game.startRoomReset = function() {
			// dim the scene, dimmer calls room.reset() on opacity: 1 && room.state === CORRECT/WRONG_ANSWER
			dimmer.style.opacity = 1.0;
			game.lockInput();
		};
		game.finishRoomReset = function() {
			let room = game.room;
			if ( room.state === Game.PREVIOUS_ROOM ) {
				room.previous();
			}
			if ( room.state === Game.WRONG_ANSWER ) {
				room.reset();
			}
			if ( room.state === Game.CORRECT_ANSWER ) {
				room.next();
			}
		}
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
				floorData: { fw: 50, fh: 50, fd: 0.0001, fm: 0, x: 0, y: 0, z: 25, rx: -90, ry: 0, rz: 0,
					floorTexture: './img/floor-wood-min.jpg', u: 2, v: 1,
					piecewise: false
				},
				doorsData: [
					{ dw: 8, dh: 11, dd: 0.5, df: 0.5, dm: 10, dld: 0.66, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0,
					answer: Game.CORRECT_ANSWER,
					frontTexture: './img/door-face-front-min.jpg',
					sideTexture: './img/door-face-side-min.jpg',
					handleModel: './model/door-handle.json',
					handleTexture: './img/door-handle-min.jpg' },
					{ dw: 8, dh: 11, dd: 0.5, df: 0.5, dm: 10, dld: 0.66, x: 20, y: 0, z: 0, rx: 0, ry: 0, rz: 0,
					answer: Game.WRONG_ANSWER,
					frontTexture: './img/door-face-front-min.jpg',
					sideTexture: './img/door-face-side-min.jpg',
					handleModel: './model/door-handle.json',
					handleTexture: './img/door-handle-min.jpg' }
				],
				wallsData: [
					{ w: 50, h: 20, d: 1, m: 0, x: 0, y: 0, z: 0, rX: 0, rY: 0, rZ: 0,
						getDoors: function( room ) { return [room.doors[0], room.doors[1]]; },
						wallTexture: './img/wallpaper-min.jpg', u: 2, v: 1 },
					{ w: 50, h: 20, d: 1, m: 0, x: 25, y: 0, z: 25, rX: 0, rY: 90, rZ: 0,
						getDoors: function( room ) { return []; },
						wallTexture: './img/wallpaper-min.jpg', u: 2, v: 1 },
					{ w: 50, h: 20, d: 1, m: 0, x: 0, y: 0, z: 50, rX: 0, rY: 0, rZ: 0,
						getDoors: function( room ) { return []; },
						wallTexture: './img/wallpaper-min.jpg', u: 2, v: 1 },
					{ w: 50, h: 20, d: 1, m: 0, x: -25, y: 0, z: 25, rX: 0, rY: 90, rZ: 0,
						getDoors: function( room ) { return []; },
						wallTexture: './img/wallpaper-min.jpg', u: 2, v: 1 },
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
					let room = game.room;
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
				previousFunc: function() {
				},
				resetFunc: function() {
					let room = game.room, player = game.player;
					// reset player BODY's position for this room
					player.body.position.set( 0, game.player.height, 25 );
					// reset room state
					room.state = Game.NO_ANSWER;
					// clear dimmer black screen
					dimmer.style.opacity = 0;
					game.unlockInput();
				},
				nextFunc: function() {

					// remove all bodies and meshes in current room
					game.destroyRoom();

					game.currRoom++;
					// create the new room
					game.room = game.createRoom( game.currRoom );

					// reset player BODY's position for this room
					game.player.body.position.set( 0, game.player.height, 25 );
					// clear dimmer black screen
					dimmer.style.opacity = 0;
					game.unlockInput();

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
			{	
				floorData: { fw: 50, fh: 50, fd: 0.0001, fm: 0, x: 0, y: 0, z: 25, rx: -90, ry: 0, rz: 0,
					floorTexture: './img/floor-wood-min.jpg', u: 2, v: 1,
					piecewise: false
				},
				doorsData: [
					{ dw: 8, dh: 11, dd: 0.5, df: 0.5, dm: 10, dld: 0.66, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0,
					answer: Game.CORRECT_ANSWER,
					frontTexture: './img/door-face-front-min.jpg',
					sideTexture: './img/door-face-side-min.jpg',
					handleModel: './model/door-handle.json',
					handleTexture: './img/door-handle-min.jpg' },
					{ dw: 8, dh: 11, dd: 0.5, df: 0.5, dm: 10, dld: 0.66, x: 20, y: 0, z: 0, rx: 0, ry: 0, rz: 0,
					answer: Game.WRONG_ANSWER,
					frontTexture: './img/door-face-front-min.jpg',
					sideTexture: './img/door-face-side-min.jpg',
					handleModel: './model/door-handle.json',
					handleTexture: './img/door-handle-min.jpg' }
				],
				wallsData: [
					{ w: 50, h: 20, d: 1, m: 0, x: 0, y: 0, z: 0, rX: 0, rY: 0, rZ: 0,
						getDoors: function( room ) { return [room.doors[0], room.doors[1]]; },
						wallTexture: './img/wallpaper-min.jpg', u: 2, v: 1 },
					{ w: 50, h: 20, d: 1, m: 0, x: 25, y: 0, z: 25, rX: 0, rY: 90, rZ: 0,
						getDoors: function( room ) { return []; },
						wallTexture: './img/wallpaper-min.jpg', u: 2, v: 1 },
					{ w: 50, h: 20, d: 1, m: 0, x: 0, y: 0, z: 50, rX: 0, rY: 0, rZ: 0,
						getDoors: function( room ) { return []; },
						wallTexture: './img/wallpaper-min.jpg', u: 2, v: 1 },
					{ w: 50, h: 20, d: 1, m: 0, x: -25, y: 0, z: 25, rX: 0, rY: 90, rZ: 0,
						getDoors: function( room ) { return []; },
						wallTexture: './img/wallpaper-min.jpg', u: 2, v: 1 },
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
					let room = game.room;
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
				previousFunc: function() {
				},
				resetFunc: function() {
				},
				nextFunc: function() {

					// remove all bodies and meshes in current room
					game.destroyRoom();

					game.currRoom--;
					// create the new room
					game.room = game.createRoom( game.currRoom );

					// reset player BODY's position for this room
					game.player.body.position.set( 0, game.player.height, 25 );
					// clear dimmer black screen
					dimmer.style.opacity = 0;
					game.unlockInput();

				}
			},
		];
		game.NUM_ROOMS = rD.length;
		game.rooms = [];
		// start all rooms with complete values === false
		for ( let r = 0; r < game.NUM_ROOMS; ++r ) {
			game.rooms.push( false );
		}
		// create a room given a room number
		game.createRoom = function( roomNumber ) {

			let room = {}, r = roomNumber;
			room.state = Game.NO_ANSWER;
			// create floor
			let fD = rD[r].floorData;
			room.floor = createFloor( {
				floorWidth: fD.fw, floorHeight: fD.fh, floorDepth: fD.fd, floorMass: fD.fm,
				floorPosition: { x: fD.x, y: fD.y, z: fD.z },
				floorRotation: { rx: fD.rx, ry: fD.ry, rz: fD.rz },
				floorTexture: fD.floorTexture, u: fD.u, v: fD.v,
				floorIsPiecewise: fD.piecewise
			} );
			// create doors
			room.modelsLoaded = 0;
			room.allModelsLoaded = false;
			let dD = rD[r].doorsData;
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
						wallTexture: wD[i].wallTexture, u: wD[i].u, v: wD[i].v
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
			// go to previous room logic
			room.previous = rD[r].previousFunc;
			// reset room logic
			room.reset = rD[r].resetFunc;
			// go to next room logic
			room.next = rD[r].nextFunc;

			return room;
		}
		// init the first room
		game.room = game.createRoom( game.currRoom );
		// open all doors of the current room and flag it as 'completed' true
		game.openDoors = function() {
			// open all doors for current room
			for ( let i = 0; i < game.room.doors.length; ++i ) {
				game.room.doors[i].body.open();
			}
			// flag current room for all doors open
			game.rooms[game.currRoom] = true;
		}
		// destroy room's bodies and meshes before a new one can be created
		game.destroyRoom = function() {
			// destroy floor
			deleteMesh( game.room.floor );
			deleteBody( game.room.floor.body );
			deleteFloor( game.room.floor );
			// destroy doors
			for ( let i = 0; i < game.room.NUM_DOORS; ++i ) {
				deleteMesh( game.room.doors[i].handle );
				deleteMesh( game.room.doors[i] );
				deleteBody( game.room.doors[i].body );
				deleteDoor( game.room.doors[i] );
			}
			// destroy walls
			for ( let i = 0; i < game.room.NUM_WALLS; ++i ) {
				deleteMesh( game.room.walls[i] );
				deleteBody( game.room.walls[i].body );
				deleteWall( game.room.walls[i] );
			}
			// destroy notes
			for ( let i = 0; i < game.room.NUM_NOTES; ++i ) {
				deleteMesh( game.room.notes[i] );
				deleteNote( game.room.notes[i] );
			}
			// delete pick objects and set size to 0
			deletePickObjects();
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
			if ( game.room.allModelsLoaded ) {
				if ( !game.inputLocked ) {
					handleInputs( dt );
				}
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
		let room = game.room;
		let floor = room.floor;
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

		floor.position.copy( floor.body.position );
		floor.quaternion.copy( floor.body.quaternion );
		
		for ( let i = 0; i < room.doors.length; ++i ) {
			let door = room.doors[i];
			door.position.copy( door.body.position );
			door.quaternion.copy( door.body.quaternion );
			door.handle.update();
			
			// if a door is open, check if player exited
			if ( door.open ) {
				room.checkExitCondition();
				if ( room.state ) {
					game.startRoomReset();
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

		if ( game.inputLocked ) {
			return;
		}

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
				for ( let i = 0; i < game.room.doors.length; ++i ) {
					let door = game.room.doors[i];
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
				for ( let i = 0; i < game.room.notes.length; ++i ) {
					let note = game.room.notes[i];
					if ( id === note.uuid ) {
						// read notes only if hud is not already reading something
						if ( !hud.isDisplaying() ) {
							note.read();
						}
						hud.show( note.src );
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

		if ( game.inputLocked ) {
			return;
		}

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

		// ensure mouseup/touchend is called on move (better UX, sometimes the
		//	mouse/touch interface gets stuck and mouseup/touchend is not called)
		if ( e.button !== Mouse.LEFT && e.button !== Mouse.RIGHT ) {
			isMouseLeftDown = false;
			isMouseRightDown = false;
		}
		
	}


	function onDocumentMouseUp( e ) {

		if ( game.inputLocked ) {
			return;
		}

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

		// ensure mouseup/touchend is called on move (better UX, sometimes the
		//	mouse/touch interface gets stuck and mouseup/touchend is not called)
		if ( e.touches.length < 2 ) { isMouseRightDown = false; }
		if ( e.touches.length < 1 ) { isMouseLeftDown = false; }

	}


	function onDocumentTouchEnd( e ) {

		if ( game.inputLocked ) {
			return;
		}

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
		eye.name = 'player';
		scene.add( eye );
		camera.position.copy( eye.position );
		// place camera at the very top of eye mesh
		camera.position.y += er;
		eye.add( camera );
		initEye( eye, eyeBody, er );
		
		return eye;

	}


	// initialize the player's eye
	function initEye( e, eb, er ) {

		// check args defined
		if ( !e && !eb && !er ) {
			de&&bug.log( 'initEye() error: some arg is not defined.' );
		}

		// check if overwriting an existing property
		if ( e.body || e.height ) {
			de&&bug.log( 'initEye() error: an existing prop was overwritten.' );
		}

		// attach physics body to mesh
		e.body = eb;

		// set the player height for room inits
		e.height = er;
		
	}


	// create floor for each room
	function createFloor( ops ) {
		
		let floorBody, floor;
		let fw = ops.floorWidth, fh = ops.floorHeight, fd = ops.floorDepth, fm = ops.floorMass, x = ops.floorPosition.x, y = ops.floorPosition.y, z = ops.floorPosition.z, rx = ops.floorRotation.rx, ry = ops.floorRotation.ry, rz = ops.floorRotation.rz, floorTexture = ops.floorTexture, u = ops.u, v = ops.v, isPiecewise = ops.floorIsPiecewise;
		let shape, rotation, quat;
		let geometry, texture, material;
		
		// setup floor physics body, very thin x,y (half extents) box will act as floor
		// floor will be rotated onto y=0 to keep on proper axis as texture and
		// all other world bodies will be init with that in mind
		if ( isPiecewise ) {
			// floor is made up of several different pieces... good for jumping levels
		} else {
			// floor is one contiguous piece
			shape = new CANNON.Box( new CANNON.Vec3( fw/2, fh/2, fd/2 ) );
			floorBody = new CANNON.Body( { mass: fm, material: physicsMaterial } );
			floorBody.addShape( shape );
			// init floor position
			floorBody.position.set( x, y -fd/2, z );
			// init floor rotation
			rotation = new CANNON.Quaternion( 0, 0, 0, 1 );
			quat = new CANNON.Quaternion( 0, 0, 0, 1 );
			quat.setFromAxisAngle( new CANNON.Vec3( 1, 0, 0 ), rx*THREE.Math.DEG2RAD );
			rotation = rotation.mult( quat );
			quat = new CANNON.Quaternion( 0, 0, 0, 1 );
			quat.setFromAxisAngle( new CANNON.Vec3( 0, 1, 0 ), ry*THREE.Math.DEG2RAD );
			rotation = rotation.mult( quat );
			quat = new CANNON.Quaternion( 0, 0, 0, 1 );
			quat.setFromAxisAngle( new CANNON.Vec3( 0, 0, 1 ), rz*THREE.Math.DEG2RAD );
			rotation = rotation.mult( quat );
			floorBody.quaternion = floorBody.quaternion.mult( rotation );
			// add floor body to physics world
			world.addBody( floorBody );
			
			// create floor mesh that acts as the room floor
			geometry = new THREE.PlaneGeometry( fw, fh, 1, 1 );
			texture = new THREE.TextureLoader().load( floorTexture );
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.repeat.set( u, v );
			material = new THREE.MeshBasicMaterial( { map: texture, 
													side: THREE.DoubleSide 
													} );
			floor =  new THREE.Mesh( geometry, material );
		}
		floor.name = 'floor';
		scene.add( floor );
		initFloor( floor, floorBody );

		return floor;

	}


	// init floor properties
	function initFloor( floor, floorBody ) {

		// check args defined
		if ( !floor && !floorBody ) {
			de&&bug.log( 'initFloor() error: some arg is not defined.' );
		}

		// check overwritting floor properties
		if ( floor.body ) {
			de&&bug.log( 'initFloor() error: an existing prop was overwritten.' );
		}

		floor.body = floorBody;

	}


	// delete floor properties
	function deleteFloor( floor ) {

		if ( floor.body ) { floor.body = null; }

	}


	// create a door, door body, and door handle objects
	function createDoor( room, ops ) {

		let door, doorBody, doorHandle, dw = ops.doorWidth, dh = ops.doorHeight, dd = ops.doorDepth, df = ops.doorOffset, dm = ops.doorMass, dld = ops.doorLinearDamping, da = ops.doorAnswer,
		x = ops.doorPosition.x, y = ops.doorPosition.y, z = ops.doorPosition.z,
		rotx = ops.doorRotation.x, roty = ops.doorRotation.y, rotz = ops.doorRotation.z;
		let answer = ops.doorAnswer;
		let shape, rotation, quat;
		let hingeBodyBot, hingeBodyTop, hingeConstraintBot, hingeConstraintTop;
		let geometry, material, texture, mats = [];


		// setup door physics body in the scene (half extents)
		shape = new CANNON.Box( new CANNON.Vec3( (dw-df)/2, (dh-df)/2, dd/2 ) );
		doorBody = new CANNON.Body( { mass: dm, material: physicsMaterial } );
		doorBody.addShape( shape );
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
		world.addBody( doorBody );
		// create bottom hinge constraint on door
		hingeBodyBot = new CANNON.Body( { mass: 0 } );
		// hingeBody must match position of doorBody!
		hingeBodyBot.position.set( x, y + dh/2, z );
		hingeBodyBot.quaternion = hingeBodyBot.quaternion.mult( rotation );
		// note that pivotA & pivotB offsets should be the same if hingeBody
		// 	position is not specified. we are basically specifying the offset
		// 	of where the rotation axis is locally from bodyB (doorBody)
		// axis should also be the same
		hingeConstraintBot = new CANNON.HingeConstraint( hingeBodyBot, doorBody, {
			pivotA: new CANNON.Vec3( -dw/2, -dh/2, dd/2 ), // pivot offsets should be same 
			axisA: new CANNON.Vec3( 0, 1, 0 ), // axis offsets should be same 
			pivotB: new CANNON.Vec3( -dw/2, -dh/2, dd/2 ), // pivot offsets should be same
			axisB: new CANNON.Vec3( 0, 1, 0 ) // axis offsets should be same
		} );
		world.addConstraint( hingeConstraintBot );
		// create top hinge constraint on door
		hingeBodyTop = new CANNON.Body( { mass: 0 } );
		hingeBodyTop.position.set( x, y + dh/2, z );
		hingeBodyTop.quaternion = hingeBodyTop.quaternion.mult( rotation );
		hingeConstraintTop = new CANNON.HingeConstraint( hingeBodyTop, doorBody, {
			pivotA: new CANNON.Vec3( -dw/2, +dh/2, dd/2 ), // pivot offsets should be same 
			axisA: new CANNON.Vec3( 0, 1, 0 ), // axis offsets should be same 
			pivotB: new CANNON.Vec3( -dw/2, +dh/2, dd/2 ), // pivot offsets should be same
			axisB: new CANNON.Vec3( 0, 1, 0 ) // axis offsets should be same
		} );
		world.addConstraint( hingeConstraintTop );

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
		door.name = 'door_' + x + ',' + y + ',' + z + '_' + answer;
		scene.add( door );
		pickObjects.push( door );
		// add open function to door (via door body)
		initDoor( door, da, doorBody, dm, dw, dh, dd, x, y, z, answer, hingeConstraintBot, hingeConstraintTop );

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
	function initDoor( dr, da, drb, dm, dw, dh, dd, dx, dy, dz, answer, hingeCBot, hingeCTop ) {
		let impulseForce, worldPoint;

		// check if door and door body defined
		if ( !dr && !da && !drb && !dm && !dw && !dh && !dd && !dx && !dy && !dz && !answer && !hingeCBot && !hingeCTop ) {
			de&&bug.log( 'initDoor() error: some arg is undefined.' );
		}

		// check for existing props
		if ( dr.body || drb.open || drb.constraints || dr.answer || dr.open || dr.dim || dr.pos ) {
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
				openForce = 66;
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

		// add constraints to the door body for future destruction
		drb.constraints = [];
		drb.constraints.push( hingeCBot, hingeCTop );

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
	
	
	// delete door properties
	function deleteDoor( dr ) {

		if ( dr.body && dr.body.open) { dr.body.open = null; }
		if ( dr.body && dr.body.constraints ) {
			for ( let i = 0; i < dr.body.constraints.length; ++i ) {
				dr.body.constraints[i] = null;
			}
			dr.body.constraints = null;
		}
		if ( dr.body ) { dr.body = null; }
		if ( dr.answer ) { dr.answer = null; }
		if ( dr.open ) { dr.open = null; }
		if ( dr.dim ) { dr.dim = null; }
		if ( dr.pos ) { dr.pos = null; }
		if ( dr.handle && dr.handle.animating ) { dr.handle.animating = null; }
		if ( dr.handle && dr.handle.update ) { dr.handle.update = null; }
		if ( dr.handle && dr.handle.toggle ) { dr.handle.toggle = null; }

	}


	// create walls
	function createWall( room, ops ) {
		
		let wallBody, wall, ww = ops.wallWidth, wh = ops.wallHeight,
		wd = ops.wallDepth, wm = ops.wallMass,
		x = ops.wallPosition.x, y = ops.wallPosition.y, z = ops.wallPosition.z,
		rotx = ops.wallRotation.x, roty = ops.wallRotation.y, rotz = ops.wallRotation.z;
		let wallTexture = ops.wallTexture, u = ops.u, v = ops.v;
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
				texture = new THREE.TextureLoader().load( wallTexture );
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.repeat.set( wd*u/ww, dh*v/wh );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				texture = new THREE.TextureLoader().load( wallTexture );
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.repeat.set( lww*u/ww, v );
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
				texture = new THREE.TextureLoader().load( wallTexture );
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.repeat.set( dw*u/ww, dd*v/wh );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
				texture = new THREE.TextureLoader().load( wallTexture );
				texture.wrapS = THREE.RepeatWrapping;
				texture.wrapT = THREE.RepeatWrapping;
				texture.repeat.set( dw*u/ww, (dh-wh)*v/wh );
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

			// wallDoor right box mesh (half extents)
			shape = new CANNON.Box( new CANNON.Vec3( rww/2, wh/2, wd/2 ) );
			wallBody.addShape( shape, new CANNON.Vec3( px +rww/2 +pdw/2, wh/2, 0 ) );
			// create right part of wall door mesh (right of door, full extents)
			geometry = new THREE.BoxGeometry( rww, wh, wd );
			mats = [];
			texture = new THREE.TextureLoader().load( wallTexture );
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.repeat.set( wd*u/ww, dh*v/wh );
			mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
			mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
			mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
			mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
			texture = new THREE.TextureLoader().load( wallTexture );
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.repeat.set( rww*u/ww, v );
			mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
			mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
			material = new THREE.MeshFaceMaterial( mats );
			wallR = new THREE.Mesh( geometry, material );
			wallR.position.set( px +rww/2 +pdw/2, wh/2, 0 );
			wall.add( wallR );

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
			texture = new THREE.TextureLoader().load( wallTexture );
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.repeat.set( u, v );
			material = new THREE.MeshBasicMaterial( { map: texture } );
			wall = new THREE.Mesh( geometry, material );
			
		}
		wall.name = 'wall_' + x + ',' + y + ',' + z;

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


	// delete wall properties
	function deleteWall( wall ) {

		if ( wall.body ) { wall.body = null; }

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
		note.name = 'note_' + fileName;
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
		if ( note.src || note.alreadyRead || note.read ) {
			de&&bug.log( 'initNote() error: existing note prop was overwritten.' );
		}

		// note src file
		note.src = noteFile;

		// has this note been read
		note.alreadyRead = false;

		// logic for reading notes
		note.read = function() {
			if ( !note.alreadyRead ) {
				note.alreadyRead = true;
				room.readCount++;
			}

			// if all notes read, open all doors
			if ( room.readCount === room.NUM_NOTES ) {
				game.openDoors();
			}
		};

	}


	// delete note properties
	function deleteNote( note ) {

		if ( note.src ) { note.src = null; }
		if ( note.alreadyRead ) { note.alreadyRead = null; }
		if ( note.read ) { note.read = null; }

	}


	// delete all pick objects and set size to 0
	function deletePickObjects() {
	
		for ( let i = 0; i < pickObjects.length; ++i ) {
			pickObjects[i] = null;
		}
		pickObjects = [];
		
	}


	// return the absolute value of a number
	function abs( n ) {
		return ( n < 0 )? -n : n;
	}


	// remove a mesh from scene
	function deleteMesh( mesh ) {
		if ( mesh instanceof THREE.Mesh ) {
			// remove mesh from scene
			scene.remove( mesh );
			// dispose of mesh geometry
			mesh.geometry.dispose();
			// dispose of mesh material and texture for a MeshBasicMaterial
			if ( mesh.material instanceof THREE.MeshBasicMaterial ) { 
				if ( mesh.material.map ) { mesh.material.map.dispose(); }
				if ( mesh.material.lightMap ) { mesh.material.lightMap.dispose(); }
				if ( mesh.material.bumpMap ) { mesh.material.bumpMap.dispose(); }
				if ( mesh.material.normalMap ) { mesh.material.normalMap.dispose(); }
				if ( mesh.material.specularMap ) { mesh.material.specularMap.dispose(); }
				if ( mesh.material.envMap ) { mesh.material.envMap.dispose(); }
				mesh.material.dispose();
			}
			// dispose of mesh material and texture for a MultiMaterial
			if ( mesh.material instanceof THREE.MultiMaterial ) {
				for ( let i = 0; i < mesh.material.materials.length; ++i ) {
					if ( mesh.material.materials[i].map ) { mesh.material.materials[i].map.dispose(); }
					if ( mesh.material.materials[i].lightMap ) { mesh.material.materials[i].lightMap.dispose(); }
					if ( mesh.material.materials[i].bumpMap ) { mesh.material.materials[i].bumpMap.dispose(); }
					if ( mesh.material.materials[i].normalMap ) { mesh.material.materials[i].normalMap.dispose(); }
					if ( mesh.material.materials[i].specularMap ) { mesh.material.materials[i].specularMap.dispose(); }
					if ( mesh.material.materials[i].envMap ) { mesh.material.materials[i].envMap.dispose(); }
					mesh.material.materials[i].dispose();
				}
			}
		}
		// handle any meshes added to this mesh (or group)
		if ( mesh.children.length ) {
			for ( let i = 0; i < mesh.children.length; ++i ) {
				deleteMesh( mesh.children[i] );
			}			
		}
	}
	

	// remove a body from physics world
	function deleteBody( body ) {
		if ( body instanceof CANNON.Body ) {
			// first remove any existing constraints
			if ( body.constraints ) {
				for ( let i = 0; i < body.constraints.length; ++i ) {
					world.removeConstraint( body.constraints[i] );
				}
			}
			// remove body from physics world
			world.removeBody( body );
		}
	}

	
	// init hud that shows all hud imgs in game
	function initHUD() {


		// create dimmer div that will appear in front of canvas and act as a
		// 	'lighting dimmer' when hud is being interacted with
		dimmer = document.createElement( 'div' );
		document.body.appendChild( dimmer );
		dimmer.style.cssText = 'width: 100vw; height: 100vh; position: fixed; z-index: 100; background: #000000; opacity: 0; transition: opacity ' + transitionLength + ';';

		// add an event handler for opacity: 1 transitionends (room exit condition)
		dimmer.addEventListener( 'transitionend', function( e ) {
			let room = game.room;
			// if dimmer transitionend with opacity 1 then this is a room exit transition
			if ( dimmer.style.opacity === '1' ) {
				game.finishRoomReset();
			} 
		} );

		
		// create hud img that will display all hud screens for game such as
		// 	splash img, ending img, and notes
		hud = document.createElement( 'img' );
		document.body.appendChild( hud );
		hud.style.cssText = 'max-width: 100vw; max-height: 100vh; position: fixed; z-index: 200; opacity: 0; transition: opacity ' + transitionLength + ';';

		// check if base defined
		if ( !base ) {
			de&&bug.log( 'initHUD() error: base is not defined.' );
		}
		// check if overwriting existing hud properties
		if ( hud.resize || hud.onload || hud.show || hud.hide || hud.transitioning ) {
			de&&bug.log( 'initHUD() error: existing hud prop was overwritten.' );
		}

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

		// add a flag so hud cannot be stopped while it is transitioning
		hud.transitioning = false;

		// add a check to see if hud is currently displaying anything
		hud.isDisplaying = function() {
			return hud.style.display !== 'none';
		}
		
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

		hud.addEventListener( 'transitionend', function( e ) {
			hud.transitioning = false;
			// do not display hud dom element if opacity is 0
			if ( e.propertyName === 'opacity' && e.srcElement.style.opacity === '0' ) {
				e.srcElement.style.display = 'none';
			}
		});


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
			PREVIOUS_ROOM : -2,
			WRONG_ANSWER : -1,
			NO_ANSWER : 0,
			CORRECT_ANSWER : 1,
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


}( window.witchr = window.witchr || {} ));