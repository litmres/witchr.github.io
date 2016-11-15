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

	// cannon.js
	let world;
	let t = 0, dt = 1/240, newTime, frameTime, currTime = performance.now(), accumulator = 0;
	let floorBody, fw = 50, fd = 50;
	let eyeBody, er = 3, em = 1; // er (eye radius), em (eye mass)
	let doorBody, dw = 10, dh = 10, dd = 1, df = 1, dm = 10000; // df (door offset in wall), dm (door mass)
	let wallsBody, ww = fd, wh = 20, wd = 1, wm = 0, wn = 3; // wm (wall mass), wn (# of non-door walls)
	let wallDoorBody;
	let impulseForce, worldPoint, hingeBotBody, hingeTopBody, hingeConstraint;
	
	// three.js
	let camera, scene, renderer, raycaster, mouse;
	let floor, eye, door, box, wallDoor, walls, objects;

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
		stats = witchr.Stats();
		document.body.appendChild( stats.dom );

		// add handlers for io events
		window.addEventListener( 'resize', onWindowResize, false );

		window.addEventListener( 'keydown', Keyboard.keyPress.bind(Keyboard), false );
		window.addEventListener( 'keyup', Keyboard.keyRelease.bind(Keyboard), false );

		document.addEventListener( 'mousedown', onDocumentMouseDown, false );
		document.addEventListener( 'mousemove', onDocumentMouseMove, false );
		document.addEventListener( 'mouseup', onDocumentMouseUp, false);
		document.addEventListener( 'mouseout', onDocumentMouseUp, false);
		// disable contextmenu on right clicks (will be used to move)
		window.oncontextmenu = function() { return false; };

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
		physicsMaterial = new CANNON.Material( 'floorMaterial' );
		physicsContactMaterial = new CANNON.ContactMaterial( physicsMaterial, 
															 physicsMaterial, 
														   { friction: 0.03,
															 restitution: 0.0
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
		

		// eye body that simulates and positions player
		shape = new CANNON.Sphere( er );
		eyeBody = new CANNON.Body( { mass: em, material: physicsMaterial } );
		eyeBody.addShape( shape );
		eyeBody.linearDamping = 0.99	;
		eyeBody.position.set( 0, er, fd/2 );
		world.addBody( eyeBody );


		// door body in the scene (half extents)
		shape = new CANNON.Box( new CANNON.Vec3( (dw-df)/2, (dh-df)/2, dd/2 ) );
		doorBody = new CANNON.Body( { mass: dm, material: physicsMaterial } );
		doorBody.linearDamping = 0.99;
		doorBody.position.set( 0, dh/2, 0 );
		doorBody.addShape( shape );
		world.addBody( doorBody );

		// test hinge constraint on door
		hingeBotBody = new CANNON.Body( { mass: 0 } );
		// hingeBody must match position of doorBody!
		hingeBotBody.position.set( 0, dh/2, 0 );
		// note that pivotA & pivotB offsets should be the same if hingeBody
		// 	position is not specified. we are basically specifying the offset
		// 	of where the rotation axis is locally from bodyB (doorBody)
		// axis should also be the same
		hingeConstraint = new CANNON.HingeConstraint( hingeBotBody, doorBody, {
			pivotA: new CANNON.Vec3( -dw/2, -dh/2, 0 ), // pivot offsets should be same 
			axisA: new CANNON.Vec3( 0, 1, 0 ), // axis offsets should be same 
			pivotB: new CANNON.Vec3( -dw/2, -dh/2, 0 ), // pivot offsets should be same
			axisB: new CANNON.Vec3( 0, 1, 0 ) // axis offsets should be same
		} );
		world.addConstraint( hingeConstraint );

		// test hinge constraint on door
		hingeTopBody = new CANNON.Body( { mass: 0 } );
		hingeTopBody.position.set( 0, dh/2, 0 );
		hingeConstraint = new CANNON.HingeConstraint( hingeTopBody, doorBody, {
			pivotA: new CANNON.Vec3( -dw/2, +dh/2, 0 ), // pivot offsets should be same 
			axisA: new CANNON.Vec3( 0, 1, 0 ), // axis offsets should be same 
			pivotB: new CANNON.Vec3( -dw/2, +dh/2, 0 ), // pivot offsets should be same
			axisB: new CANNON.Vec3( 0, 1, 0 ) // axis offsets should be same
		} );
		world.addConstraint( hingeConstraint );
	
	
		// test impulse force on door
		impulseForce = new CANNON.Vec3( 0, 0, 300000 );
		worldPoint = new CANNON.Vec3( doorBody.position.x,
									  doorBody.position.y,
									  doorBody.position.z
									);
		doorBody.applyImpulse( impulseForce, worldPoint );


		// immovable wall that has a door on it
		wallDoorBody = new CANNON.Body( { mass: wm } );
		// wallDoor top box mesh
		shape = new CANNON.Box( new CANNON.Vec3( dw/2, (wh-dh)/2, dd/2 ) );
		wallDoorBody.addShape( shape, new CANNON.Vec3( 0, ((wh-dh)/2)+dh, 0 ) );
		// wallDoor left box mesh
		shape = new CANNON.Box( new CANNON.Vec3( (ww-dw)/4, wh/2, wd/2 ) );
		wallDoorBody.addShape( shape, new CANNON.Vec3( -((ww-dw)/4)-dw/2, wh/2, 0 ) );
		// wallDoor right box mesh
		wallDoorBody.addShape( shape, new CANNON.Vec3( +((ww-dw)/4)+dw/2, wh/2, 0 ) );

		world.addBody( wallDoorBody );


		// walls body
		wallsBody = [];
		shape = new CANNON.Box( new CANNON.Vec3( ww/2, wh/2, wd/2 ) );
		for ( let i = 0; i < wn; ++i ) {
			wallsBody[i] = new CANNON.Body( { mass: wm } );
			wallsBody[i].addShape( shape );
			world.addBody( wallsBody[i] );
		}
		// position the back wall, left side wall, right side wall
		wallsBody[Wall.BACK].position.set( 0, wh/2, fd );
		wallsBody[Wall.LEFT].quaternion.setFromAxisAngle( new CANNON.Vec3( 0, 1, 0 ), 
														 -90*THREE.Math.DEG2RAD
														);
		wallsBody[Wall.LEFT].position.set( -fw/2, wh/2, fd/2 );
		wallsBody[Wall.RIGHT].quaternion.setFromAxisAngle( new CANNON.Vec3( 0, 1, 0 ),
														  -90*THREE.Math.DEG2RAD
														);
		wallsBody[Wall.RIGHT].position.set( fw/2, wh/2, fd/2 );


		



	}


	function initThree() {

		let floorGeometry, floorTexture, floorMaterial;
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

		raycaster = new THREE.Raycaster();
		mouse = new THREE.Vector2();

		// floor mesh acts as the room floor
		floorGeometry = new THREE.PlaneGeometry( fw, fd, 1, 1 );
		floorTexture = new THREE.TextureLoader().load( 'img/old_wood.jpg' );
		floorTexture.wrapS = THREE.RepeatWrapping;
		floorTexture.wrapT = THREE.RepeatWrapping;
		floorTexture.repeat.set( 2, 1 );
		floorMaterial = new THREE.MeshBasicMaterial( { map: floorTexture, 
														side: THREE.DoubleSide 
													} );
		floor =  new THREE.Mesh( floorGeometry, floorMaterial );
		scene.add( floor );


		// eye mesh really just for troubleshooting
		geometry = new THREE.SphereGeometry( er, 16, 16 );
		material = new THREE.MeshBasicMaterial( { color: 0xff0000, 
												  wireframe: true, 
												  transparent: true, 
												  opacity: 0.1 
											  } );
		eye = new THREE.Mesh( geometry, material );
		scene.add( eye );
		camera.position.copy( eye.position );
		// place camera at the very top of eye
		camera.position.y += er;
		eye.add( camera );
		

		// box mesh for door for troubleshooting
		geometry = new THREE.BoxGeometry( dw-df, dh-df, dd );
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


		// wall that has a door on it
		wallDoor = new THREE.Mesh();
		// wallDoor top box mesh
		geometry = new THREE.BoxGeometry( dw, wh-dh, wd );
		material = new THREE.MeshBasicMaterial( { color: 0x0000ff, 
												  wireframe: true 
											  } );
		let wallDoorT = new THREE.Mesh( geometry, material );
		wallDoorT.position.set( 0, ((wh-dh)/2)+dh, 0 );
		wallDoor.add( wallDoorT );

		// wallDoor left box mesh
		geometry = new THREE.BoxGeometry( (ww-dw)/2, wh, wd );
		material = new THREE.MeshBasicMaterial( { color: 0x0000ff, 
												  wireframe: true 
											  } );
		let wallDoorL = new THREE.Mesh( geometry, material );
		wallDoorL.position.set( -((ww-dw)/4)-dw/2, wh/2, 0 );
		wallDoor.add( wallDoorL );

		// wallDoor right box mesh
		let wallDoorR = new THREE.Mesh( geometry, material );
		wallDoorR.position.set( ((ww-dw)/4)+dw/2, wh/2, 0 );
		wallDoor.add( wallDoorR );

		scene.add( wallDoor );


		// other three walls that make up the room
		walls = [];
		geometry = new THREE.BoxGeometry( ww, wh, wd );
		for ( let i = 0; i < wn; ++i ) {
			walls[i] = new THREE.Mesh( geometry, material );
			scene.add( walls[i] );
		}


		



		// test clicking on paper on floor 
		objects = [];
		geometry = new THREE.BoxGeometry( 1, 1, 1 );
		let paper = new THREE.Mesh( geometry,
									new THREE.MeshBasicMaterial( { color: 0xffffff, wireframe: true } )
								  );
		paper.position.set( 1, 1/2, 1 );
		scene.add( paper );
		objects.push( paper );

		let paper2 = new THREE.Mesh( geometry,
									new THREE.MeshBasicMaterial( { color: 0xffffff, wireframe: true } )
								  );
		paper2.position.set( 10, 1/2, 10 );
		scene.add( paper2 );
		objects.push( paper2 );

		let paper3 = new THREE.Mesh( geometry,
									new THREE.MeshBasicMaterial( { color: 0xffffff, wireframe: true } )
								  );
		paper3.position.set( 11, 1/2, 8 );
		scene.add( paper3 );
		objects.push( paper3 );

		

	}



	/*********************************************************
	 * main game loop
	 *********************************************************
	 */
	function gameloop() {

		Game.stopGameLoop = requestAnimationFrame( gameloop );

		newTime = performance.now();
		frameTime = newTime - currTime;
		frameTime *= 0.001; // need frame time in seconds 
		currTime = newTime;

		accumulator += frameTime;

		while ( accumulator >= dt ) {

			handleInputs( dt );
			updatePhysics();

			accumulator -= dt;
			t += dt;

		}


		renderer.render( scene, camera ); // render the scene
		stats.update();

	}


	function updatePhysics() {

		world.step( dt );

		// reset eye quaternion so we only rotate by offsets
		eyeBody.quaternion.set( 0, 0, 0, 1 );

		// local rotation about the x-axis
		let rotSide = new CANNON.Quaternion( 0, 0, 0, 1 );
		rotSide.setFromAxisAngle( new CANNON.Vec3( 0, 1, 0 ), rotY );
		eyeBody.quaternion = eyeBody.quaternion.mult( rotSide );

		// local rotation about the y-axis
		let rotUp = new CANNON.Quaternion( 0, 0, 0, 1 );
		rotUp.setFromAxisAngle( new CANNON.Vec3( 1, 0, 0 ), rotX );
		eyeBody.quaternion = eyeBody.quaternion.mult( rotUp );


		// set all of the meshes to the physics bodies
		floor.position.copy( floorBody.position );
		floor.quaternion.copy( floorBody.quaternion );

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

			wallDoor.position.copy( wallDoorBody.position );
			wallDoor.quaternion.copy( wallDoorBody.quaternion );

			for ( let i = 0; i < wn; ++i ) {
				walls[i].position.copy( wallsBody[i].position );
				walls[i].quaternion.copy( wallsBody[i].quaternion );
			}

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
		if ( isMouseRightDown ) {

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
			// grab the first object we intersect if any
			let intersects = raycaster.intersectObjects( objects );
			if ( intersects.length ) {
				intersects[0].object.material.color.setHex( Math.random() * 0xffffff );
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

		// reset rotation tracking to position of last touch on screen
		mouseXOnMouseDown = e.touches[0].clientX - windowHalfX;
		mouseYOnMouseDown = e.touches[0].clientY - windowHalfY;
		targetRotationOnMouseDownX = targetRotationX;
		targetRotationOnMouseDownY = targetRotationY;

		if ( e.touches.length === 0 ) { isMouseLeftDown = false; }
		if ( e.touches.length === 1 ) { isMouseRightDown = false; }

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
			MOVE_SPEED: 66,
			ROTATE_SPEED: 10,		// speed to reach desired rotation
			ROTATE_OFFSET_DAMP: 0.002	// offset sensitivity
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

		// init mouse clicks
		Mouse = {
			LEFT: 0,
			MIDDLE: 1,
			RIGHT: 2
		};
		
		// non-door containing walls
		Wall = {
			BACK: 0, LEFT: 1, RIGHT: 2
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