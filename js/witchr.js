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
	let world, wf = 0.0, wr = 0.0; // wf (world friction), wr (world restitution)
	let t = 0, dt = 1/240, newTime, frameTime, currTime = performance.now(), accumulator = 0;
	let floorBody, fw = 50, fd = 50;
	let eyeBody, er = 3, em = 10, eld = 0.99; // er (eye radius), em (eye mass), eld (eye linear damping)
	let doorBody, dw = 8, dh = 11, dd = 0.5, df = 0.5, dm = 10, dld = 0.66; // df (door offset in wall), dm (door mass), dld (door linear damping)
	let wallsBody, ww = fd, wh = 20, wd = 1, wm = 0, wn = 3; // wm (wall mass), wn (# of non-door walls)
	let wallDoorBody;
	let impulseForce, worldPoint, hingeBotBody, hingeTopBody, hingeConstraint;
	
	// three.js
	let camera, scene, renderer, raycaster, mouse, pickDistance = 5;
	let floor, eye, door, wallDoor, walls;
	let pickObjects, notes, nw = 3, nh = 3, nd = 0.001, nn = 3, img;

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


		wallsBody = [];
		let physicsMaterial, physicsContactMaterial;
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


		// setup door physics body in the scene (half extents)
		shape = new CANNON.Box( new CANNON.Vec3( (dw-df)/2, (dh-df)/2, dd/2 ) );
		doorBody = new CANNON.Body( { mass: dm, material: physicsMaterial } );
		// door body starts with a mass so physics knows it is initially a
		// 	moving body but it should start closed so let's freeze it via mass 0
		doorBody.mass = 0;
		doorBody.updateMassProperties();
		doorBody.linearDamping = dld;
		doorBody.position.set( 0, dh/2, dd/2 );
		doorBody.addShape( shape );
		world.addBody( doorBody );
		// create bottom hinge constraint on door
		hingeBotBody = new CANNON.Body( { mass: 0 } );
		// hingeBody must match position of doorBody!
		hingeBotBody.position.set( 0, dh/2, 0 );
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
		hingeTopBody.position.set( 0, dh/2, 0 );
		hingeConstraint = new CANNON.HingeConstraint( hingeTopBody, doorBody, {
			pivotA: new CANNON.Vec3( -dw/2, +dh/2, dd/2 ), // pivot offsets should be same 
			axisA: new CANNON.Vec3( 0, 1, 0 ), // axis offsets should be same 
			pivotB: new CANNON.Vec3( -dw/2, +dh/2, dd/2 ), // pivot offsets should be same
			axisB: new CANNON.Vec3( 0, 1, 0 ) // axis offsets should be same
		} );
		world.addConstraint( hingeConstraint );

	
		// create walls: first wall physics body that contains door
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
		
		// create other walls physics bodies
		shape = new CANNON.Box( new CANNON.Vec3( ww/2, wh/2, wd/2 ) );
		for ( let i = 0; i < wn; ++i ) {
			wallsBody[i] = new CANNON.Body( { mass: wm } );
			wallsBody[i].addShape( shape );
			world.addBody( wallsBody[i] );
		}
		// position the other walls: back wall, left side wall, right side wall
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
		
		walls = [], pickObjects = [], notes = [];
		let geometry, material, texture, mats = [];
		let loader;
		let doorHandle, wallDoorT, wallDoorL, wallDoorR, paper;
		
		
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
		

		// create door as a textured box mesh
		geometry = new THREE.BoxGeometry( dw-df, dh-df, dd );
		// texture door sides
		texture = new THREE.TextureLoader().load( './img/door_face_side-min.jpg' );
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( 1, 1 );
        mats.push(new THREE.MeshBasicMaterial( { map: texture } ) );
        mats.push(new THREE.MeshBasicMaterial( { map: texture } ) );
        mats.push(new THREE.MeshBasicMaterial( { map: texture } ) );
        mats.push(new THREE.MeshBasicMaterial( { map: texture } ) );
		// texture door front & back
		texture = new THREE.TextureLoader().load( './img/door_face_front-min.jpg' );
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
		initDoor( door, doorBody );


		// create door handle via asynchronous load json file
		XHR( './model/door_handle.json', function( data ) {
			loader = new THREE.ObjectLoader();
			// load door handle obj group (will be stuck to door)
			doorHandle = JSON.parse( data );
			doorHandle = loader.parse( doorHandle );
			// setup door handle texture (from shiny metallic img)
			texture = new THREE.TextureLoader().load( './img/door_handle-min.jpg' );
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.repeat.set( 1, 1 );
			// add texture to door handle obj group (from .json loader)
			doorHandle.children[0].material = new THREE.MeshBasicMaterial( { map: texture } )
			// stick door handle appropriately on door
			doorHandle.position.set( 0.41*dw, -0.06*dh, 0 );
			door.add( doorHandle );
			// add update and toggle functions to door handle
			initDoorHandle( door, doorHandle );


			// signal all models are loaded (if waiting for scene)
			modelsLoaded = true;
		} );


		// create the wall door parts separately and add them to wall door
		// 	(the wall that has a door in it)
		wallDoor = new THREE.Mesh();
		// create top part of wall door mesh (right above door)
		geometry = new THREE.BoxGeometry( dw, wh-dh, wd );
		mats = [];
		texture = new THREE.TextureLoader().load( './img/wallpaper-min.jpg' );
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( dw*2/ww, dd/wh );
		mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
		mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
		mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
		mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
		texture = new THREE.TextureLoader().load( './img/wallpaper-min.jpg' );
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( dw*2/ww, (dh-wh)/wh );
		mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
		mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
		material = new THREE.MeshFaceMaterial( mats );
		wallDoorT = new THREE.Mesh( geometry, material );
		wallDoorT.position.set( 0, ((wh-dh)/2)+dh, 0 );
		wallDoor.add( wallDoorT );
		// create left part of wall door mesh
		geometry = new THREE.BoxGeometry( (ww-dw)/2, wh, wd );
		mats = [];
		texture = new THREE.TextureLoader().load( './img/wallpaper-min.jpg' );
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( wd*2/ww, dh/wh );
		mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
		mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
		mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
		mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
		texture = new THREE.TextureLoader().load( './img/wallpaper-min.jpg' );
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( (ww-dw)/ww, 1 );
		mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
		mats.push( new THREE.MeshBasicMaterial( { map: texture } ) );
		material = new THREE.MeshFaceMaterial( mats );
		wallDoorL = new THREE.Mesh( geometry, material );
		wallDoorL.position.set( -((ww-dw)/4)-dw/2, wh/2, 0 );
		wallDoor.add( wallDoorL );
		// create right part of wall door mesh
		wallDoorR = new THREE.Mesh( geometry, material );
		wallDoorR.position.set( ((ww-dw)/4)+dw/2, wh/2, 0 );
		wallDoor.add( wallDoorR );
		// add the completed wall door to scene
		scene.add( wallDoor );


		// create other three wall meshes that make up the room
		geometry = new THREE.BoxGeometry( ww, wh, wd );
		// create full wall textures
		texture = new THREE.TextureLoader().load( './img/wallpaper-min.jpg' );
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( 2, 1 );
		material = new THREE.MeshBasicMaterial( { map: texture } );
		for ( let i = 0; i < wn; ++i ) {
			walls[i] = new THREE.Mesh( geometry, material );
			scene.add( walls[i] );
		}


		// create notes that will be spread all over room
		geometry = new THREE.BoxGeometry( nw, nh, nd );
		// create note texture
		texture = new THREE.TextureLoader().load( './img/note1.png' );
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( 1, 1 );
		material = new THREE.MeshBasicMaterial( { map: texture, alphaTest: 0.5 } );
		// create all notes
		for ( let i = 0; i < nn; ++i ) {
			paper = new THREE.Mesh( geometry, material );
			paper.position.set( ww/3*i - ww/3, dh/2, ww-wd );
			scene.add( paper );
			notes.push( paper );
			pickObjects.push( paper );
		}
		paper = null;
		// create the hud imgs when notes are read
		// img = document.createElement( 'img' );
		// document.body.appendChild( img );
		// img.style.cssText = 'width: 80vw; position: fixed; top: 10vh; left: 10vw; z-index: 100';
		// img.src = './img/note1.png';
		
		

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


		// reset eye quaternion so we always rotate offset from origin
		eyeBody.quaternion.set( 0, 0, 0, 1 );
		// local rotation about the x-axis
		let rotSide = new CANNON.Quaternion( 0, 0, 0, 1 );
		rotSide.setFromAxisAngle( new CANNON.Vec3( 0, 1, 0 ), rotY );
		eyeBody.quaternion = eyeBody.quaternion.mult( rotSide );
		// local rotation about the y-axis
		let rotUp = new CANNON.Quaternion( 0, 0, 0, 1 );
		rotUp.setFromAxisAngle( new CANNON.Vec3( 1, 0, 0 ), rotX );
		eyeBody.quaternion = eyeBody.quaternion.mult( rotUp );


		// set all of the meshes to their physics bodies
		floor.position.copy( floorBody.position );
		floor.quaternion.copy( floorBody.quaternion );
		
		door.position.copy( doorBody.position );
		door.quaternion.copy( doorBody.quaternion );

		eye.position.copy( eyeBody.position );
		eye.quaternion.copy( eyeBody.quaternion );

		wallDoor.position.copy( wallDoorBody.position );
		wallDoor.quaternion.copy( wallDoorBody.quaternion );
		for ( let i = 0; i < wn; ++i ) {
			walls[i].position.copy( wallsBody[i].position );
			walls[i].quaternion.copy( wallsBody[i].quaternion );
		}


		// update pickable objects
		door.handle.update();


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
				if ( id === door.uuid ) {
					door.handle.toggle();
				}

				// check notes
				for ( let i = 0; i < notes.length; ++i ) {
					if ( id === notes[i].uuid ) {
						door.body.open();
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


	// toggle door body impulse (and change door mass so it can be opened)
	function initDoor( dr, drb ) {

		// check if door and door body defined
		if ( !dr && !drb ) {
			de&&bug.log( 'initDoor() error: door or door body undefined.' );
		}

		// check for existing props
		if ( dr.body || drb.open ) {
			de&&bug.log( 'initDoor() error: an existing door body prop was overwritten' );
		}

		// attach door body to door
		dr.body = drb;

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
		}
		
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
		}

		// toggle door handle animation
		dh.toggle = function() {
			if ( !dh.animating ) {
				dh.animating = true;
			}
		}


	}


}( window.witchr = window.witchr || {} ));