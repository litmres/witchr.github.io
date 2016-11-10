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
	let ground, eye, door, box;

	// cannon.js
	let world;
	let timeStep = 1 / 60, time = performance.now();
	let groundBody, eyeBody, doorBody;
	
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

	let timeClick = 0;
	let isMouseDown = false;

	let windowHalfX = window.innerWidth / 2;
	let windowHalfY = window.innerHeight / 2;


	let modelsLoaded = false;
	

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
		world.solver.iterations = 1;
		world.gravity.set( 0, -10, 0 );

		// create a slippery material
		physicsMaterial = new CANNON.Material( 'groundMaterial' );
		physicsContactMaterial = new CANNON.ContactMaterial( physicsMaterial, 
															 physicsMaterial, 
														   { friction: 0.03,
															 restitution: 0.0
														   } );

		world.addContactMaterial( physicsContactMaterial );

		// ground plane body which acts as room floor
		shape = new CANNON.Plane();
		groundBody = new CANNON.Body( { mass: 0, material: physicsMaterial } );
		groundBody.addShape( shape );
		groundBody.quaternion.setFromAxisAngle( new CANNON.Vec3( 1, 0, 0 ), 
												-90 * THREE.Math.DEG2RAD
											  );
		groundBody.position.set( 0, -10, 0 );
		world.addBody( groundBody );
		

		// eye body that simulates and positions player
		shape = new CANNON.Sphere( 5 );
		eyeBody = new CANNON.Body( { mass: 1, material: physicsMaterial } );
		eyeBody.addShape( shape );
		eyeBody.linearDamping = 0.99	;
		eyeBody.position.set( 0, -5, 20 );
		world.addBody( eyeBody );


		// door body in the scene 
		shape = new CANNON.Box( new CANNON.Vec3( 4.5, 4.5, 0.5 ) );
		doorBody = new CANNON.Body( { mass: 10000, material: physicsMaterial } );
		doorBody.linearDamping = 0.99;
		let doorY = -5;
		doorBody.position.set( 0, doorY, 0 );
		doorBody.addShape( shape );
		world.addBody( doorBody );
		

		// test door angular velocity
		// doorBody.angularVelocity = new CANNON.Vec3( 0, 9, 0 );

		// test impulse force on door
		let impulseForce = new CANNON.Vec3( 0, 0, 300000 );
		let worldPoint = new CANNON.Vec3( doorBody.position.x,
										  doorBody.position.y,
										  doorBody.position.z
									    );
		doorBody.applyImpulse( impulseForce, worldPoint );

		// test hinge constraint on door
		let hingeBotBody = new CANNON.Body( { mass: 0 } );
		// hingeBody must match position of doorBody!
		hingeBotBody.position.set( 0, doorY, 0 );
		// note that pivotA & pivotB offsets should be the same if hingeBody
		// 	position is not specified. we are basically specifying the offset
		// 	of where the rotation axis is locally from bodyB (doorBody)
		// axis should also be the same
		let hingeConstraint = new CANNON.HingeConstraint( hingeBotBody, doorBody, {
			pivotA: new CANNON.Vec3( -5, -5, 0 ), // pivot offsets should be same 
			axisA: new CANNON.Vec3( 0, 1, 0 ), // axis offsets should be same 
			pivotB: new CANNON.Vec3( -5, -5, 0 ), // pivot offsets should be same
			axisB: new CANNON.Vec3( 0, 1, 0 ) // axis offsets should be same
		} );
		world.addConstraint( hingeConstraint );

		// test hinge constraint on door
		let hingeTopBody = new CANNON.Body( { mass: 0 } );
		hingeTopBody.position.set( 0, doorY, 0 );
		hingeConstraint = new CANNON.HingeConstraint( hingeTopBody, doorBody, {
			pivotA: new CANNON.Vec3( -5, +5, 0 ), // pivot offsets should be same 
			axisA: new CANNON.Vec3( 0, 1, 0 ), // axis offsets should be same 
			pivotB: new CANNON.Vec3( -5, +5, 0 ), // pivot offsets should be same
			axisB: new CANNON.Vec3( 0, 1, 0 ) // axis offsets should be same
		} );
		world.addConstraint( hingeConstraint );
		
		

	}


	function initThree() {

		let groundGeometry, groundTexture, groundMaterial;
		let geometry, material;
		let loader;
		
		// init the camera, scene,  renderer
		camera = new THREE.PerspectiveCamera( 75, 
											  window.innerWidth / window.innerHeight, 
											  0.1, 
											  110 
											);
		camera.lookAt( 0, 0, 0 );

		scene = new THREE.Scene();
		// scene.fog = new THREE.Fog( 0x000000, 0.01, 3 );
		// scene.fog = new THREE.FogExp2( 0x000000, 0.8 );
		scene.add( camera );

		renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.setSize( window.innerWidth * Canvas.SIZE, 
						  window.innerHeight * Canvas.SIZE
						);
		renderer.setClearColor( 0x000000 );
		document.body.appendChild( renderer.domElement );

		// ground mesh acts as the room floor
		groundGeometry = new THREE.PlaneGeometry( 50, 50, 1, 1 );
		groundTexture = new THREE.TextureLoader().load( 'img/old_wood.jpg' );
		groundTexture.wrapS = THREE.RepeatWrapping;
		groundTexture.wrapT = THREE.RepeatWrapping;
		groundTexture.repeat.set( 2, 1 );
		groundMaterial = new THREE.MeshBasicMaterial( { map: groundTexture, 
														side: THREE.DoubleSide 
													} );
		ground =  new THREE.Mesh( groundGeometry, groundMaterial );
		scene.add( ground );


		// eye mesh really just for troubleshooting
		geometry = new THREE.SphereGeometry( 5, 16, 16 );
		material = new THREE.MeshBasicMaterial( { color: 0xff0000, 
												  wireframe: true, 
												  transparent: true, 
												  opacity: 1 
											  } );
		eye = new THREE.Mesh( geometry, material );
		scene.add( eye );
		camera.position.copy( eye.position );
		eye.add( camera );
		

		// box mesh for door for troubleshooting
		geometry = new THREE.BoxGeometry( 9, 9, 1 );
		material = new THREE.MeshBasicMaterial( { color: 0x00ff00, 
												  wireframe: true 
											  } );
		box = new THREE.Mesh( geometry, material );
		scene.add( box );



		// asynchronously load json file and add to scene
		XHR( 'model/door.json', function( data ) {
			
			loader = new THREE.ObjectLoader();

			// door obj mesh that appears in room
			door = JSON.parse( data );
			door = loader.parse( door );
			scene.add( door );

			modelsLoaded = true;

		} );




		

	}



	/*********************************************************
	 * main game loop
	 *********************************************************
	 */
	function gameloop() {

		Game.stopGameLoop = requestAnimationFrame( gameloop );

		handleInputs( performance.now() - time );

		updatePhysics( performance.now() - time );

		renderer.render( scene, camera ); // render the scene

		stats.update();

		time = performance.now();

	}


	function updatePhysics( timeDelta ) {

		timeDelta *= 0.001;

		world.step( timeStep );

		// get the rotation offset values from mouse and touch input
		rotX += ( targetRotationY - rotX ) * Player.ROTATE_SPEED * timeDelta;
		rotY += ( targetRotationX - rotY ) * Player.ROTATE_SPEED * timeDelta;

		// reset eye quaternion so we only rotate by offsets
		eyeBody.quaternion.set( 0, 0, 0, 1 );

		// local rotation about the y-axis
		let rotUp = new CANNON.Quaternion( 0, 0, 0, 1 );
		rotUp.setFromAxisAngle( new CANNON.Vec3( 0, 1, 0 ), rotY );
		eyeBody.quaternion = eyeBody.quaternion.mult( rotUp );

		// local rotation about the x-axis
		let rotSide = new CANNON.Quaternion( 0, 0, 0, 1 );
		rotSide.setFromAxisAngle( new CANNON.Vec3( 1, 0, 0 ), rotX );
		eyeBody.quaternion = eyeBody.quaternion.mult( rotSide );


		// set all of the meshes to the physics bodies
		ground.position.copy( groundBody.position );
		ground.quaternion.copy( groundBody.quaternion );

		box.position.copy( doorBody.position );
		box.quaternion.copy( doorBody.quaternion );

		eye.position.copy( eyeBody.position );
		eye.quaternion.copy( eyeBody.quaternion );

		if ( modelsLoaded ) {

			door.position.copy( doorBody.position );
			// door needs to be rotated since it lies flatly in xz
			let rotDoor = new CANNON.Quaternion( 0, 0, 0, 1 );
			rotDoor.setFromAxisAngle( new CANNON.Vec3( 1, 0, 0 ),
									  -90 * THREE.Math.DEG2RAD 
									);
			door.quaternion.copy( doorBody.quaternion.mult( rotDoor ) );

		}

	}


	/*********************************************************
	 * handle keyboard, mouse, touch inputs
	 *********************************************************
	 */
	// handle keyboard input
	function handleInputs( timeDelta ) {

		timeDelta *= 0.001;

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
			inputVelocity.x += -Player.MOVE_SPEED * timeDelta;
		}
		if ( Keyboard.keys[Key.UP] || Keyboard.keys[Key.W] ) {
			inputVelocity.z += -Player.MOVE_SPEED * timeDelta;
		}
		if ( Keyboard.keys[Key.RIGHT] || Keyboard.keys[Key.D] ) {
			inputVelocity.x += +Player.MOVE_SPEED * timeDelta;
		}
		if ( Keyboard.keys[Key.DOWN] || Keyboard.keys[Key.S] ) {
			inputVelocity.z += +Player.MOVE_SPEED * timeDelta;
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

		
		// handle isMouseDown input from click or tap
		if ( isMouseDown ) {

			inputVelocity.z += -Player.MOVE_SPEED * timeDelta;

		}


		// apply the euler angle quaternion to the velocity vector so we can add
		// 	the appropriate amount for each x and z component to translate
		inputVelocity.applyQuaternion( quat );
		eyeBody.velocity.x += inputVelocity.x;
		eyeBody.velocity.z += inputVelocity.z;

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

		timeClick = performance.now();

		isMouseDown = true;

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
		
		if ( ( performance.now() ) - timeClick < Player.QUICK_CLICK ) {
			// do something on quick click
		}

		isMouseDown = false;
		
	}


	function onDocumentMouseOut( e ) {
		
		document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
		document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
		document.removeEventListener( 'mouseout', onDocumentMouseOut, false );
		
		if ( ( performance.now() ) - timeClick < Player.QUICK_CLICK ) {
			// do something on quick click
		}

		isMouseDown = false;	

	}


	function onDocumentTouchStart( e ) {

		if ( e.touches.length === 1 ) {

			e.preventDefault();

			mouseXOnMouseDown = e.touches[ 0 ].pageX - windowHalfX;
			targetRotationOnMouseDownX = targetRotationX;

			mouseYOnMouseDown = e.touches[ 0 ].pageY - windowHalfY;
			targetRotationOnMouseDownY = targetRotationY;

			timeClick = ( performance.now() );
			
		}

		isMouseDown = true;
		
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

		if ( ( performance.now() ) - timeClick < Player.QUICK_CLICK ) {
			// do something on quick click
		}

		isMouseDown = false;

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
			MOVE_SPEED: 30,
			QUICK_CLICK: 300,
			ROTATE_SPEED: 2,		// speed to reach desired rotation
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
				this.keys[e.keyCode] = e.timeStamp || ( performance.now() );
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
		renderer.setSize( window.innerWidth * Canvas.SIZE, 
						  window.innerHeight * Canvas.SIZE 
						);

		// reset logic based on window size
		windowHalfX = window.innerWidth / 2;
		windowHalfY = window.innerHeight / 2;

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


}( window.witchr = window.witchr || {} ));