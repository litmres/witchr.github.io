/**
 * @fileoverview witchr 48 hour game jam for orcajam 2016. 
 * @author @superafable
 */


'use strict';


(function( witchr, undefined ) {

	let de = true;
	let bug = console;

	// enums
	let Canvas, Game, Player, Keyboard, Key;

	// fps stats
	let stats;

	// three.js
	let camera, scene, renderer;
	let ground, cube, capsule;

	// cannon.js
	let world;
	let timeStep = 1 / 60, time = performance.now();
	let groundBody, cubeBody, capsuleBody;
	
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

	let clickTimer = 0;
	let moveForward = 0;

	let windowHalfX = window.innerWidth / 2;
	let windowHalfY = window.innerHeight / 2;
	

	window.onload = init();


	/*********************************************************
	 * initialize scene 
	 *********************************************************
	 */
	function init() {

		initEnums();

		initCannon();

		initThree();

		// init stats
		stats = new Stats();
		document.body.appendChild( stats.dom );

		// add handlers for io events
		window.addEventListener( 'resize', onWindowResize, false );

		window.addEventListener( 'keydown', Keyboard.keyPress.bind(Keyboard), false );
		window.addEventListener( 'keyup', Keyboard.keyRelease.bind(Keyboard), false );

		document.addEventListener( 'mousedown', onDocumentMouseDown, false );

		document.addEventListener( 'touchstart', onDocumentTouchStart, false );
		document.addEventListener( 'touchmove', onDocumentTouchMove, false );
		document.addEventListener( 'touchend', onDocumentTouchEnd, false );


		// start an rAF for the gameloop
		requestAnimationFrame( gameloop );

	}

	function initCannon() {

		let physicsMaterial, physicsContactMaterial;
		let shape;

		// setup worlds
		world = new CANNON.World();
		world.broadphase = new CANNON.NaiveBroadphase();
		world.solver.iterations = 10;
		world.gravity.set( 0, -1, 0 );

		// create a slippery material
		physicsMaterial = new CANNON.Material( 'groundMaterial' );
		physicsContactMaterial = new CANNON.ContactMaterial( physicsMaterial, 
															 physicsMaterial, 
														   { friction: 0.0005,
															 restitution: 0.0
														   } );

		world.addContactMaterial( physicsContactMaterial );

		// create ground plane
		shape = new CANNON.Plane();
		groundBody = new CANNON.Body( { mass: 0, material: physicsMaterial } );
		groundBody.addShape( shape );
		groundBody.quaternion.setFromAxisAngle( new CANNON.Vec3( 1, 0, 0 ), -90 * THREE.Math.DEG2RAD );
		groundBody.position.set( 0, -1, 0 );
		world.addBody( groundBody );
		

		// box in center
		shape = new CANNON.Box( new CANNON.Vec3( 0.5, 0.5, 0.5 ) );
		cubeBody = new CANNON.Body( { mass: 1000, material: physicsMaterial } );
		cubeBody.addShape( shape );
		cubeBody.angularVelocity.set( 0, 1, 0 );
		// cubeBody.angularDamping = 0.99;
		// cubeBody.linearDamping = 0.99;
		world.addBody( cubeBody );
	

		// capsule that simulates the player
		shape = new CANNON.Cylinder( 0.5, 0.5, 1, 16 );
		capsuleBody = new CANNON.Body( { mass: 1, material: physicsMaterial } );
		capsuleBody.addShape( shape );
		// capsuleBody.angularDamping = 0.9;
		// capsuleBody.linearDamping = 0.9;
		world.addBody( capsuleBody );
		capsuleBody.position.x += 2;

		
		
        // // Materials
        // groundMaterial = new CANNON.Material("groundMaterial");

        // // Adjust constraint equation parameters for ground/ground contact
        // ground_ground_cm = new CANNON.ContactMaterial(groundMaterial, groundMaterial, {
        //     friction: 0.9,
        //     restitution: 0.9,
        //     contactEquationStiffness: 1e8,
        //     contactEquationRelaxation: 3,
        //     frictionEquationStiffness: 1e8,
        //     frictionEquationRegularizationTime: 3,
        // });

		// // ground plane
        // var groundShape = new CANNON.Plane();
        // var groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
        // groundBody.addShape(groundShape);
        // world.add(groundBody);

        // // Add contact material to the world
        // world.addContactMaterial(ground_ground_cm);	



	}

	function initThree() {

		let groundGeometry, groundTexture, groundMaterial;
		let geometry, material;
		
		// init the camera, scene,  renderer
		camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 100 );
		camera.lookAt( 0, 0, 0 );
		camera.position.z += 5;
		camera.position.y += 1;

		scene = new THREE.Scene();
		// scene.fog = new THREE.Fog( 0x000000, 0.01, 3 );
		// scene.fog = new THREE.FogExp2( 0x000000, 0.8 );
		scene.add( camera );

		renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.setSize( window.innerWidth * Canvas.SIZE, window.innerHeight * Canvas.SIZE );
		renderer.setClearColor( 0x000000 );
		document.body.appendChild( renderer.domElement );

		// init ground
		groundGeometry = new THREE.PlaneGeometry( 20, 20, 1, 1 );
		groundTexture = new THREE.TextureLoader().load( 'img/old_wood.jpg' );
		groundTexture.wrapS = THREE.RepeatWrapping;
		groundTexture.wrapT = THREE.RepeatWrapping;
		groundTexture.repeat.set( 8, 4 );
		groundMaterial = new THREE.MeshBasicMaterial( { map: groundTexture, side: THREE.DoubleSide } );
		ground =  new THREE.Mesh( groundGeometry, groundMaterial );
		scene.add( ground );


		// cube mesh in center of screen
		geometry = new THREE.BoxGeometry( 1, 1, 1 );
		material = new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: true } );
		cube = new THREE.Mesh( geometry, material );
		scene.add( cube );



		geometry = new THREE.CylinderGeometry( 0.5, 0.5, 1, 16 );
		material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true, transparent: true, opacity: 1 } );
		capsule = new THREE.Mesh( geometry, material );
		scene.add( capsule );
		// capsule.add( camera );


		// let floorTexture = new THREE.TextureLoader().load('img/old_wood.jpg');
		// floorTexture.wrapS = THREE.RepeatWrapping;
		// floorTexture.wrapT = THREE.RepeatWrapping;
		// floorTexture.repeat.set( 8, 4 );
		// let floorMaterial = new THREE.MeshBasicMaterial( { map: floorTexture, side: THREE.DoubleSide } );
		// let floorGeometry = new THREE.PlaneGeometry( 20, 20, 1, 1 );
		// let floor = new THREE.Mesh( floorGeometry, floorMaterial );
		// floor.rotation.x = 90 * THREE.Math.DEG2RAD;
		// floor.position.y -= 1;
		// scene.add( floor );
		
		

		// init sky (not needed for this game)
		// init fog

		// init objects in scene, in this case just the cubes
		// let wallGeometry = new THREE.BoxGeometry( 4, 2, 0.1 );
		// let friction = 0.9; // high friction
		// let restitution = 0.1; // low restitution
		// let wallTexture = new THREE.TextureLoader().load('img/paper_pattern.jpg');
		// wallTexture.wrapS = THREE.RepeatWrapping;
		// wallTexture.wrapT = THREE.RepeatWrapping;
		// wallTexture.repeat.set( 2, 1 );
		// let wallMaterial = new THREE.MeshBasicMaterial( { map: wallTexture, side: THREE.DoubleSide } );
		// walls.push( new THREE.Mesh( wallGeometry, wallMaterial ) );
		// walls.push( new THREE.Mesh( wallGeometry, wallMaterial ) );
		// walls.push( new THREE.Mesh( wallGeometry, wallMaterial ) );
		// walls.push( new THREE.Mesh( wallGeometry, wallMaterial ) );
		// for ( let i = 0; i < walls.length; ++i ) {
		// 	scene.add( walls[i] );
		// }
		// walls[1].position.x = 2;
		// walls[1].position.z = 2;
		// walls[1].rotation.y += 90 * THREE.Math.DEG2RAD;

		// walls[2].position.x = -2;
		// walls[2].position.z = 2;
		// walls[2].rotation.y += 90 * THREE.Math.DEG2RAD;

		// walls[3].position.x = 0;
		// walls[3].position.z = 4;
		

		



		// geometry = new THREE.BoxGeometry( 1, 1, 1 );
		// material = new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: true } );
		// mesh = new THREE.Mesh( geometry, material );
		// scene.add( mesh );

	}



	/*********************************************************
	 * main game loop
	 *********************************************************
	 */
	function gameloop() {

		Game.stopGameLoop = requestAnimationFrame( gameloop );

		handleKeyboard( performance.now() - time );

		updatePhysics( performance.now() - time );

		renderer.render( scene, camera ); // render the scene

		stats.update();

		time = performance.now();

	}


	function updatePhysics( timeDelta ) {

		world.step( timeStep );

		ground.position.copy( groundBody.position );
		ground.quaternion.copy( groundBody.quaternion );

		cube.position.copy( cubeBody.position );
		cube.quaternion.copy( cubeBody.quaternion );

		capsule.position.copy( capsuleBody.position );
		capsule.quaternion.copy( capsuleBody.quaternion );

		// mesh.position.copy( body.position );
		// mesh.quaternion.copy( body.quaternion );

		// capsule.position.copy( capsuleBody.position );
		// capsule.quaternion.copy( capsuleBody.quaternion );


		// rotate camera in x and y offsets (about y and x axis respectively)
		// 	based of mousedown and mousemove
		rotX += ( targetRotationY - rotX ) * Player.ROTATE_SPEED_DAMP;
		rotY += ( targetRotationX - rotY ) * Player.ROTATE_SPEED_DAMP;

		// // reset capsule (& camera) rotation on each render and set it
		// //  according to our player's rotX and rotY values
		// // order makes a huge difference here!! rotate on y first, then x!!
		// // capsule.rotation.set( 0, 0, 0 );
		// // capsule.rotateOnAxis( new THREE.Vector3( 0, 1, 0 ), rotY );
		// // capsule.rotateOnAxis( new THREE.Vector3( 1, 0, 0 ), rotX );
		// capsuleBody.quaternion.y = 0;
		// capsuleBody.quaternion.y += rotY;
		// capsuleBody.quaternion.x = 0;
		// capsuleBody.quaternion.x += rotX;


		// handle moveforward input from click or tap
		// if ( moveForward > 0 ) {

		// 	// get partial step to move forward (ease into location)
		// 	let step = moveForward * Player.STEP_DAMP;

		// 	// translate capsule keeping y position static
		// 	// let y = capsule.position.y;
		// 	// capsule.translateZ( -step );
		// 	// capsule.position.y = y;
		// 	let y = capsuleBody.position.y;
		// 	capsuleBody.position.z += -step;
		// 	capsuleBody.position.y = y;

		// 	// decrement move offset (ease into location)
		// 	moveForward -= step;

		// }

	}


	/*********************************************************
	 * handle keyboard, mouse, touch inputs
	 *********************************************************
	 */
	// handle keyboard input
	function handleKeyboard( timeDelta ) {

		timeDelta *= 0.001;

		// translate only in x,z and make sure to keep y position static
		if ( Keyboard.keys[Key.LEFT] || Keyboard.keys[Key.A] ) {
			capsuleBody.position.x += -Player.MOVE_SPEED * timeDelta;
		}
		if ( Keyboard.keys[Key.UP] || Keyboard.keys[Key.W] ) {
			capsuleBody.position.z += -Player.MOVE_SPEED * timeDelta;
		}
		if ( Keyboard.keys[Key.RIGHT] || Keyboard.keys[Key.D] ) {
			capsuleBody.position.x += +Player.MOVE_SPEED * timeDelta;
		}
		if ( Keyboard.keys[Key.DOWN] || Keyboard.keys[Key.S] ) {
			capsuleBody.position.z += +Player.MOVE_SPEED * timeDelta;
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

	}
	
	

	
	
	

	// handle mouse input
	function onDocumentMouseDown( e ) {

		e.preventDefault();

		document.addEventListener( 'mousemove', onDocumentMouseMove, false );
		document.addEventListener( 'mouseup', onDocumentMouseUp, false);
		document.addEventListener( 'mouseout', onDocumentMouseOut, false);
		
		mouseXOnMouseDown = e.clientX - windowHalfX;
		targetRotationOnMouseDownX = targetRotationX;

		mouseYOnMouseDown = e.clientY - windowHalfY;
		targetRotationOnMouseDownY = targetRotationY;

		clickTimer = ( new Date() ).getTime();

	}

	function onDocumentMouseMove( e ) {

		mouseX = e.clientX - windowHalfX;

		targetRotationX = targetRotationOnMouseDownX + ( mouseX - mouseXOnMouseDown ) * Player.ROTATE_OFFSET_DAMP;

		mouseY = e.clientY - windowHalfY;

		targetRotationY = targetRotationOnMouseDownY + ( mouseY - mouseYOnMouseDown ) * Player.ROTATE_OFFSET_DAMP;
		// targetRotationY (rotX looking up/down) from should be max 90 deg
		if ( targetRotationY * THREE.Math.RAD2DEG > 90 ) {
			targetRotationY = 90 * THREE.Math.DEG2RAD;
		}
		if ( targetRotationY * THREE.Math.RAD2DEG < -90 ) {
			targetRotationY = -90 * THREE.Math.DEG2RAD;
		}

	}

	function onDocumentMouseUp( e ) {
		
		document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
		document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
		document.removeEventListener( 'mouseout', onDocumentMouseOut, false );
		
		if ( ( new Date() ).getTime() - clickTimer < Player.STEP_TIMER ) {
			moveForward = Player.STEP;
		}
		
	}

	function onDocumentMouseOut( e ) {
		
		document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
		document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
		document.removeEventListener( 'mouseout', onDocumentMouseOut, false );
		
		if ( ( new Date() ).getTime() - clickTimer < Player.STEP_TIMER ) {
			moveForward = Player.STEP;
		}

	}

	function onDocumentTouchStart( e ) {

		if ( e.touches.length === 1 ) {

			e.preventDefault();

			mouseXOnMouseDown = e.touches[ 0 ].pageX - windowHalfX;
			targetRotationOnMouseDownX = targetRotationX;

			mouseYOnMouseDown = e.touches[ 0 ].pageY - windowHalfY;
			targetRotationOnMouseDownY = targetRotationY;

			clickTimer = ( new Date() ).getTime();
			
		}

	}

	function onDocumentTouchMove( e ) {

		if ( e.touches.length === 1 ) {

			e.preventDefault();

			mouseX = e.touches[ 0 ].pageX - windowHalfX;
			targetRotationX = targetRotationOnMouseDownX + ( mouseX - mouseXOnMouseDown ) * Player.ROTATE_OFFSET_DAMP;

			mouseY = e.touches[ 0 ].pageY - windowHalfY;
			targetRotationY = targetRotationOnMouseDownY + ( mouseY - mouseYOnMouseDown ) * Player.ROTATE_OFFSET_DAMP;
			// targetRotationY (rotX looking up/down) from should be max 90 deg
			if ( targetRotationY * THREE.Math.RAD2DEG > 90 ) {
				targetRotationY = 90 * THREE.Math.DEG2RAD;
			}
			if ( targetRotationY * THREE.Math.RAD2DEG < -90 ) {
				targetRotationY = -90 * THREE.Math.DEG2RAD;
			}

		}

	}

	function onDocumentTouchEnd( e ) {

		if ( ( new Date() ).getTime() - clickTimer < Player.STEP_TIMER ) {
			moveForward = Player.STEP;
		}

	}


	/*********************************************************
	 * initialize all enumerated types
	 *********************************************************
	 */
	function initEnums() {
		
		// init canvas to not take up so much space (scrollbars appear) 
		Canvas = {
			SIZE: 1 
		};

		// init game object and properties
		Game = {
			stopGameLoop: 0
		};

		// init player properties
		Player = {
			MOVE_SPEED: 1,
			STEP: 0.3,
			STEP_DAMP: 0.05,
			STEP_TIMER: 200,
			ROTATE_SPEED_DAMP: 0.2,		// speed to reach desired rotation
			ROTATE_OFFSET_DAMP: 0.002	// x offset sensitivity
		};

		// init keyboard input keycodes
		Key = {
			LEFT: 37,
			UP: 38,
			RIGHT: 39,
			DOWN: 40,
			A: 65,
			W: 87,
			D: 68,
			S: 83,
			R: 82,
			F: 70,
			SPACE: 32,
			CTRL: 17
		};

		// init handle keyboard input
		Keyboard = {
			keys: {},
			keyPress: function( e ) {
				// e.preventDefault();
				if ( this.keys[e.keyCode] > 0 ) { return; }
				this.keys[e.keyCode] = e.timeStamp || ( new Date() ).getTime();
				e.stopPropagation();
			},
			keyRelease: function( e ) {
				// e.preventDefault();
				this.keys[e.keyCode] = 0;
				e.stopPropagation();
			}
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
		renderer.setSize( window.innerWidth * Canvas.SIZE, window.innerHeight * Canvas.SIZE );

		// reset logic based on window size
		windowHalfX = window.innerWidth / 2;
		windowHalfY = window.innerHeight / 2;

	}


}( window.witchr = window.witchr || {} ));