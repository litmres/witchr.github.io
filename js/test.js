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

	let targetRotationX = 0;
	let targetRotationOnMouseDownX = 0;
	let targetRotationY = 0;
	let targetRotationOnMouseDownY = 0;

	let mouseX = 0;
	let mouseXOnMouseDown = 0;
	let mouseY = 0;
	let mouseYOnMouseDown = 0;

	let windowHalfX = window.innerWidth / 2;
	let windowHalfY = window.innerHeight / 2;
	
	let Canvas, Player, Key, Keyboard;

	init();
	render();

	/*********************************************************
	 * initialize scene 
	 *********************************************************
	 */
	// init scene, camera, renderer
	function init() {
		
		// init all enums that will be used from here on out
		initEnums();

		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 100);
		renderer = new THREE.WebGLRenderer();
		renderer.setSize( window.innerWidth*Canvas.SIZE, window.innerHeight*Canvas.SIZE );
		document.body.appendChild( renderer.domElement );



		// init objects in scene, in this case just the cube
		let geometry = new THREE.BoxGeometry( 1, 1, 1 );
		let material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
		cubes.push( new THREE.Mesh( geometry, material ) );
		cubes.push( new THREE.Mesh( geometry, material ) );
		cubes.push( new THREE.Mesh( geometry, material ) );

		material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
		cubes.push( new THREE.Mesh( geometry, material ) );
		
		for ( let i = 0; i < cubes.length; ++i ) {
			cubes[i].position.x -= 2 * i;
			scene.add( cubes[i] );
		}

		// add blue cube behind you
		material = new THREE.MeshBasicMaterial( { color: 0x0000ff } );
		cubes.push( new THREE.Mesh( geometry, material ) );
		cubes[4].position.z += 10;
		scene.add( cubes[4] );

		// add ground
		geometry = new THREE.BoxGeometry( 10, 0.1, 10 );
		material = new THREE.MeshBasicMaterial( { color: 0x660000, wireframe: true } );
		cubes.push( new THREE.Mesh( geometry, material ) );
		cubes[5].position.y -= 0.55;
		scene.add( cubes[5] );

		cubes.push( new THREE.Mesh( geometry, material ) );
		cubes[6].position.y -= 0.55;
		cubes[6].position.z += 10;
		scene.add( cubes[6] );

		
		
		
		// setup the scene, move the camera 5 units back in z so we can see cube
		camera.position.z = 5;

		// add all event listeners
		window.addEventListener( 'resize', onWindowResize, false );

		window.addEventListener( 'keydown', Keyboard.keyPress.bind(Keyboard), false );
		window.addEventListener( 'keyup', Keyboard.keyRelease.bind(Keyboard), false );

		document.addEventListener( 'mousedown', onDocumentMouseDown, false );

	}

	function onWindowResize() {

		renderer.setSize( window.innerWidth * Canvas.SIZE, window.innerHeight * Canvas.SIZE );
		windowHalfX = window.innerWidth / 2;
		windowHalfY = window.innerHeight / 2;

	}


	/*********************************************************
	 * render gameloop 
	 *********************************************************
	 */
	function render() {

		requestAnimationFrame( render );

		// rotate camera in x & y offsets (about y & x axis respectively)
		camera.rotation.y += ( targetRotationX - camera.rotation.y ) * Player.ROTATE_SPEED_DAMP;
		camera.rotation.x += ( targetRotationY - camera.rotation.x ) * Player.ROTATE_SPEED_DAMP;

		// handle keyboard input
		handleKeyboard( Keyboard.keys );

		renderer.render( scene, camera );

	}
	

	/*********************************************************
	 * handle keyboard, mouse, touch inputs
	 *********************************************************
	 */
	// handle keyboard input
	function handleKeyboard( keys ) {

		if ( keys[Key.LEFT] || keys[Key.A] ) {
			camera.position.x -= Player.MOVE_SPEED;
		}
		if ( keys[Key.UP] || keys[Key.W] ) {
			camera.position.z -= Player.MOVE_SPEED;
		}
		if ( keys[Key.RIGHT] || keys[Key.D] ) {
			camera.position.x += Player.MOVE_SPEED;
		}
		if ( keys[Key.DOWN] || keys[Key.S] ) {
			camera.position.z += Player.MOVE_SPEED;
		}
		if ( keys[Key.SPACE] ) {
			de&&bug.log( 'spacebar pressed.' );
		}
		if ( keys[Key.CTRL] ) {
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

	}

	function onDocumentMouseMove( e ) {

		mouseX = e.clientX - windowHalfX;

		targetRotationX = targetRotationOnMouseDownX + ( mouseX - mouseXOnMouseDown ) * Player.ROTATE_OFFSET_DAMP;

		mouseY = e.clientY - windowHalfY;

		targetRotationY = targetRotationOnMouseDownY + ( mouseY - mouseYOnMouseDown ) * Player.ROTATE_OFFSET_DAMP;

	}

	function onDocumentMouseUp( e ) {
		
		document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
		document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
		document.removeEventListener( 'mouseout', onDocumentMouseOut, false );
		
	}

	function onDocumentMouseOut( e ) {
		
		document.removeEventListener( 'mousemove', onDocumentMouseMove, false );
		document.removeEventListener( 'mouseup', onDocumentMouseUp, false );
		document.removeEventListener( 'mouseout', onDocumentMouseOut, false );
		
	}

	/*********************************************************
	 * initialize all enumerated types
	 *********************************************************
	 */
	function initEnums() {
		
		// init canvas to not take up so much space (scrollbars appear) 
		Canvas = {
			SIZE: 0.99
		}; 

		// init player properties
		Player = {
			MOVE_SPEED: 0.05,
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
			SPACE: 32,
			CTRL: 17
		};

		// init handle keyboard input
		Keyboard = {
			keys: {},
			keyPress: function( e ) {
				//e.preventDefault();
				if ( this.keys[e.keyCode] > 0 ) { return; }
				this.keys[e.keyCode] = e.timeStamp || ( new Date() ).getTime();
				e.stopPropagation();
			},
			keyRelease: function( e ) {
				//e.preventDefault();
				this.keys[e.keyCode] = 0;
				e.stopPropagation();
			}
		};

	}

}( window.witchr = window.witchr || {} ));