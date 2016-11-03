/**
 * @fileoverview witchr 48 hour game jam for orcajam 2016. 
 * @author @superafable
 */


'use strict';


(function( witchr, undefined ) {

	let de = true;
	let bug = console;

	let stats;

	let scene, camera, renderer;

	let walls = [];
	let capsule;

	let targetRotationX = 0;
	let targetRotationOnMouseDownX = 0;
	let targetRotationY = 0;
	let targetRotationOnMouseDownY = 0;

	let mouseX = 0;
	let mouseXOnMouseDown = 0;
	let mouseY = 0;
	let mouseYOnMouseDown = 0;

	let rotX = 0;
	let rotY = 0;

	let moveForward = 0;
	let clickTimer = 0;

	let windowHalfX = window.innerWidth / 2;
	let windowHalfY = window.innerHeight / 2;
	
	let Canvas, Game, Player, Key, Keyboard;


	window.onload = init();


	/*********************************************************
	 * initialize scene 
	 *********************************************************
	 */
	// init scene, camera, renderer
	function init() {

		// init all enums that will be used from here on out
		initEnums();

		// init scene
		initScene();

		// init stats
		stats = new Stats();
		document.body.appendChild( stats.dom );

		// add all event listeners
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

	function initScene() {

		// init the renderer, scene, and camera
		renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.setSize( window.innerWidth * Canvas.SIZE, window.innerHeight * Canvas.SIZE );
		renderer.setClearColor( 0x000000 );
		document.body.appendChild( renderer.domElement );

		scene = new THREE.Scene();

		camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 100 );
		camera.lookAt( scene.position );
		scene.add( camera );

		// init floor
		let floorTexture = new THREE.TextureLoader().load('img/old_wood.jpg');
		floorTexture.wrapS = THREE.RepeatWrapping;
		floorTexture.wrapT = THREE.RepeatWrapping;
		floorTexture.repeat.set( 8, 4 );
		let floorMaterial = new THREE.MeshBasicMaterial( { map: floorTexture, side: THREE.DoubleSide } );
		let floorGeometry = new THREE.PlaneGeometry( 20, 20, 1, 1 );
		let floor = new THREE.Mesh( floorGeometry, floorMaterial );
		floor.rotation.x = 90 * THREE.Math.DEG2RAD;
		floor.position.y -= 1;
		scene.add( floor );

		// init sky (not needed for this game)
		// init fog
		// scene.fog = new THREE.Fog( 0x000000, 0.01, 3 );
		scene.fog = new THREE.FogExp2( 0x000000, 0.8 );

		// init objects in scene, in this case just the cubes
		let wallGeometry = new THREE.BoxGeometry( 4, 2, 0.1 );
		let friction = 0.9; // high friction
		let restitution = 0.1; // low restitution
		let wallTexture = new THREE.TextureLoader().load('img/paper_pattern.jpg');
		wallTexture.wrapS = THREE.RepeatWrapping;
		wallTexture.wrapT = THREE.RepeatWrapping;
		wallTexture.repeat.set( 2, 1 );
		let wallMaterial = new THREE.MeshBasicMaterial( { map: wallTexture, side: THREE.DoubleSide } );
		walls.push( new THREE.Mesh( wallGeometry, wallMaterial ) );
		walls.push( new THREE.Mesh( wallGeometry, wallMaterial ) );
		walls.push( new THREE.Mesh( wallGeometry, wallMaterial ) );
		walls.push( new THREE.Mesh( wallGeometry, wallMaterial ) );
		for ( let i = 0; i < walls.length; ++i ) {
			scene.add( walls[i] );
		}
		walls[1].position.x = 2;
		walls[1].position.z = 2;
		walls[1].rotation.y += 90 * THREE.Math.DEG2RAD;

		walls[2].position.x = -2;
		walls[2].position.z = 2;
		walls[2].rotation.y += 90 * THREE.Math.DEG2RAD;

		walls[3].position.x = 0;
		walls[3].position.z = 4;
		

		let geometry = new THREE.CylinderGeometry( 0.5, 0.5, 1, 16 );
		let wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true, transparent: true, opacity: 0.3 } );
		capsule = new THREE.Mesh( geometry, wireframeMaterial, 1 );
		scene.add( capsule );
		capsule.add( camera );
		
		// move capsule +1z to be inside room and -0.5y to be on the floor
		capsule.position.y = -0.5;
		capsule.position.z = 1;






	}



	/*********************************************************
	 * main game loop
	 *********************************************************
	 */
	function gameloop( tFrame ) {

		Game.stopGameLoop = requestAnimationFrame( gameloop );

		handleKeyboard( Keyboard.keys );

		update( tFrame ); // update scene rotations and translations

		renderer.render( scene, camera ); // render the scene

		stats.update();

		// let tNow = window.performance.now();	
		// de&&bug.log( 'Game.stopGameLoop:', Game.stopGameLoop, 'tFrame:', tFrame, 'tNow:', tNow );
		// cancelAnimationFrame( Game.stopGameLoop );

	}

	function update( tFrame ) {
		
		// rotate camera in x and y offsets (about y and x axis respectively)
		// 	based of mousedown and mousemove
		rotX += ( targetRotationY - rotX ) * Player.ROTATE_SPEED_DAMP;
		rotY += ( targetRotationX - rotY ) * Player.ROTATE_SPEED_DAMP;

		// reset capsule (& camera) rotation on each render and set it
		//  according to our player's rotX and rotY values
		// order makes a huge difference here!! rotate on y first, then x!!
		capsule.rotation.set( 0, 0, 0 );
		capsule.rotateOnAxis( new THREE.Vector3( 0, 1, 0 ), rotY );
		capsule.rotateOnAxis( new THREE.Vector3( 1, 0, 0 ), rotX );

		// handle moveforward input from click or tap
		if ( moveForward > 0 ) {

			// get partial step to move forward (ease into location)
			let step = moveForward * Player.STEP_DAMP;

			// translate capsule keeping y position static
			let y = capsule.position.y;
			capsule.translateZ( -step );
			capsule.position.y = y;

			// decrement move offset (ease into location)
			moveForward -= step;

		}

	}


	/*********************************************************
	 * handle keyboard, mouse, touch inputs
	 *********************************************************
	 */
	// handle keyboard input
	function handleKeyboard( keys ) {

		// translate only in x,z and make sure to keep y position static
		if ( keys[Key.LEFT] || keys[Key.A] ) {
			translatePlayer( 'translateX', -Player.MOVE_SPEED );
		}
		if ( keys[Key.UP] || keys[Key.W] ) {
			translatePlayer( 'translateZ', -Player.MOVE_SPEED );
		}
		if ( keys[Key.RIGHT] || keys[Key.D] ) {
			translatePlayer( 'translateX', Player.MOVE_SPEED );
		}
		if ( keys[Key.DOWN] || keys[Key.S] ) {
			translatePlayer( 'translateZ', Player.MOVE_SPEED );
		}
		if ( keys[Key.R] ) {
			de&&bug.log( 'r pressed.' );
		}
		if ( keys[Key.F] ) {
			de&&bug.log( 'f pressed.' );
		}
		if ( keys[Key.SPACE] ) {
			de&&bug.log( 'space pressed.' );
		}
		if ( keys[Key.CTRL] ) {
			de&&bug.log( 'ctrl pressed.' );
		}

	}

	function translatePlayer( func, speed ) {

		// translate capsule but keep y static
		let y = capsule.position.y;
		capsule[func]( speed );
		capsule.position.y = y;
		
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
			MOVE_SPEED: 0.01,
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