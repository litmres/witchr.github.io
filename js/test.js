/**
 * @fileoverview witchr 48 hour game jam for orcajam 2016. 
 * @author @superafable
 */

'use strict';

(function( witchr, undefined ) {

	let de = true;
	let bug = console;

	let scene, camera, renderer;

	let cubes = [];
	let circle;

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

	init();
	gameloop();


	/*********************************************************
	 * initialize scene 
	 *********************************************************
	 */
	// init scene, camera, renderer
	function init() {
		
		// init all enums that will be used from here on out
		initEnums();

		// init the scene, camera, and renderer
		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 100 );
		renderer = new THREE.WebGLRenderer();
		renderer.setSize( window.innerWidth*Canvas.SIZE, window.innerHeight*Canvas.SIZE );
		renderer.setClearColor( 0x000000 );
		document.body.appendChild( renderer.domElement );

		// init floor
		let floorTexture = new THREE.TextureLoader().load('img/checkerboard.jpg');
		floorTexture.wrapS = THREE.RepeatWrapping;
		floorTexture.wrapT = THREE.RepeatWrapping;
		floorTexture.repeat.set( 4, 4 );
		let floorMaterial = new THREE.MeshBasicMaterial( { map: floorTexture, side: THREE.DoubleSide } );
		let floorGeometry = new THREE.PlaneGeometry( 20, 20, 1, 1 );
		let floor = new THREE.Mesh( floorGeometry, floorMaterial );
		floor.rotation.x = 90 * THREE.Math.DEG2RAD;
		floor.position.y -= 1;
		scene.add( floor );

		// init sky (not needed for this game)
		// init fog
		// scene.fog = new THREE.Fog( 0x000000, 0.1, 7 );
		scene.fog = new THREE.FogExp2( 0x000000, 0.3 );

		// init objects in scene, in this case just the cube
		let geometry = new THREE.BoxGeometry( 1, 1, 1 );
		let darkMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
		let wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0x00ffff, wireframe: true, transparent: true } );
		let multiMaterial = [ darkMaterial, wireframeMaterial ];
		cubes.push( new THREE.Mesh( geometry, wireframeMaterial ) );
		// cubes.push( new THREE.Mesh( geometry, darkMaterial ) );
		// cubes.push( new THREE.SceneUtils.createMultiMaterialObject( geometry, multiMaterial ) ); // collision detection stops working for multiMaterialObject
		
		for ( let i = 0; i < cubes.length; ++i ) {
			scene.add( cubes[i] );
		}

		geometry = new THREE.CircleGeometry( 1, 8 );
		wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true, transparent: true, opacity: 0.3 } );
		circle = new THREE.Mesh( geometry, wireframeMaterial );

		// move the camera 5 units back in z so we can see cube and place the
		// 	circle hit underneath it
		camera.position.z = 5;
		circle.position.y = -0.3;
		circle.position.z = 5;
		scene.add( circle );

		// add all event listeners
		window.addEventListener( 'resize', onWindowResize, false );

		window.addEventListener( 'keydown', Keyboard.keyPress.bind(Keyboard), false );
		window.addEventListener( 'keyup', Keyboard.keyRelease.bind(Keyboard), false );

		document.addEventListener( 'mousedown', onDocumentMouseDown, false );

		document.addEventListener( 'touchstart', onDocumentTouchStart, false );
		document.addEventListener( 'touchmove', onDocumentTouchMove, false );
		document.addEventListener( 'touchend', onDocumentTouchEnd, false );

	}


	/*********************************************************
	 * main game loop
	 *********************************************************
	 */
	function gameloop( tFrame ) {

		Game.stopGameLoop = requestAnimationFrame( gameloop );

		// do not start logic until rAF gives us a frame id
		if ( tFrame ) {
			handleKeyboard( Keyboard.keys );
			update( tFrame );
			collisions( tFrame, Keyboard.keys );
		}

		render();

		// let tNow = window.performance.now();	
		// de&&bug.log( 'Game.stopGameLoop:', Game.stopGameLoop, 'tFrame:', tFrame, 'tNow:', tNow );
		// cancelAnimationFrame( Game.stopGameLoop );
	}

	function update( tFrame ) {
		
		// rotate camera in x and y offsets (about y and x axis respectively)
		// 	based of mousedown and mousemove
		rotX += ( targetRotationY - rotX ) * Player.ROTATE_SPEED_DAMP;
		rotY += ( targetRotationX - rotY ) * Player.ROTATE_SPEED_DAMP;
		// reset camera rotation on each render and set it according to our
		// 	player's rotX and rotY values
		camera.rotation.set( 0, 0, 0 );
		// order makes a huge difference here!! rotate on y first, then x!!
		camera.rotateOnAxis( new THREE.Vector3( 0, 1, 0 ), rotY );
		camera.rotateOnAxis( new THREE.Vector3( 1, 0, 0 ), rotX );

		// reset circle rotation on each render and set it to -90 after so
		//	that it appears underneath player camera without messing around
		//  with its local coordinate system
		circle.rotation.set( 0, 0, 0 );
		circle.rotateOnAxis( new THREE.Vector3( 0, 1, 0 ), rotY );
		circle.rotateOnAxis( new THREE.Vector3( 1, 0, 0 ), rotX );
		circle.rotateOnAxis( new THREE.Vector3( 1, 0, 0 ), -90 * THREE.Math.DEG2RAD );

		// handle moveforward input from click or tap
		if ( moveForward ) {

			let step = moveForward * Player.MOVE_SPEED;

			let y = camera.position.y;
			camera.translateZ( -step );
			camera.position.y = y;

			circle.rotation.set( 0, 0, 0 );
			circle.rotateOnAxis( new THREE.Vector3( 0, 1, 0 ), rotY );
			circle.rotateOnAxis( new THREE.Vector3( 1, 0, 0 ), rotX );
			let hitY = circle.position.y;
			circle.translateZ( -step );
			circle.position.y = hitY;
			circle.rotateOnAxis( new THREE.Vector3( 1, 0, 0 ), -90 * THREE.Math.DEG2RAD );

			moveForward -= step;

		}

	}

	// handle collision detection
	function collisions( tFrame, keys ) {

		let originPoint = circle.position.clone();

		for ( let i = 0; i < circle.geometry.vertices.length; ++i ) {
			let localVertex = circle.geometry.vertices[i].clone();
			let globalVertex = localVertex.applyMatrix4( circle.matrix );
			let directionVector = globalVertex.sub( circle.position );

			let ray = new THREE.Raycaster( originPoint, directionVector.clone().normalize() );
			let collisionResults = ray.intersectObjects( cubes );

			if ( collisionResults.length > 0 && collisionResults[0].distance < directionVector.length() ) {
				de&&bug.log( 'collision detected.' );
				// undo translations for all current keys being pressed
				if ( keys[Key.LEFT] || keys[Key.A] ) {
					translatePlayer( camera, circle, 'translateX', +Player.MOVE_SPEED * 2 );
				}
				if ( keys[Key.UP] || keys[Key.W] ) {
					translatePlayer( camera, circle, 'translateZ', +Player.MOVE_SPEED * 2 );
				}
				if ( keys[Key.RIGHT] || keys[Key.D] ) {
					translatePlayer( camera, circle, 'translateX', -Player.MOVE_SPEED * 2 );
				}
				if ( keys[Key.DOWN] || keys[Key.S] ) {
					translatePlayer( camera, circle, 'translateZ', -Player.MOVE_SPEED * 2 );
				}
				
			}
		}

	}

	function render() {

		// render next scene
		renderer.render( scene, camera );
		
	}
	

	/*********************************************************
	 * handle keyboard, mouse, touch inputs
	 *********************************************************
	 */
	// handle keyboard input
	function handleKeyboard( keys ) {

		// translate only in x,z and make sure to keep y position static
		if ( keys[Key.LEFT] || keys[Key.A] ) {
			translatePlayer( camera, circle, 'translateX', -Player.MOVE_SPEED );
		}
		if ( keys[Key.UP] || keys[Key.W] ) {
			translatePlayer( camera, circle, 'translateZ', -Player.MOVE_SPEED );
		}
		if ( keys[Key.RIGHT] || keys[Key.D] ) {
			translatePlayer( camera, circle, 'translateX', Player.MOVE_SPEED );
		}
		if ( keys[Key.DOWN] || keys[Key.S] ) {
			translatePlayer( camera, circle, 'translateZ', Player.MOVE_SPEED );
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

	function translatePlayer( cam, hit, func, speed ) {
		let camY = cam.position.y;
		cam[func]( speed );
		cam.position.y = camY;

		// reset circle rotation to its y rotation, apply translation in z,
		// 	and then re-apply rotation in x to show circle underneath player
		// 	(this way we can maintain circles local coordinate space)
		circle.rotation.set( 0, 0, 0 );
		circle.rotateOnAxis( new THREE.Vector3( 0, 1, 0 ), rotY );
		circle.rotateOnAxis( new THREE.Vector3( 1, 0, 0 ), rotX );
		let hitY = hit.position.y;
		hit[func]( speed );
		hit.position.y = hitY;
		circle.rotateOnAxis( new THREE.Vector3( 1, 0, 0 ), -90 * THREE.Math.DEG2RAD );
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
			moveForward += Player.STEP;
		}
		
	}

	function onDocumentMouseOut( e ) {
		
		document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
		document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
		document.removeEventListener( 'mouseout', onDocumentMouseOut, false );
		
		if ( ( new Date() ).getTime() - clickTimer < Player.STEP_TIMER ) {
			moveForward += Player.STEP;
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
			moveForward += Player.STEP;
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
			MOVE_SPEED: 0.05,
			STEP: 1,
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