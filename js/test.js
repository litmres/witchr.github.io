/**
 * @fileoverview witchr 48 hour game jam for orcajam 2016. 
 * @author @superafable
 */

'use strict';

(function( witchr, undefined ) {
	let scene = new THREE.Scene();
	let camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
	let renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );
	window.addEventListener('resize', function() {
		renderer.setSize( window.innerWidth, window.innerHeight );
	}, false);
	document.body.appendChild( renderer.domElement );

	let geometry = new THREE.BoxGeometry( 1, 1, 1 );
	let material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
	let cube = new THREE.Mesh( geometry, material );
	scene.add( cube );

	let speedCam = 0.1;
	camera.position.z = 5;

	function render() {
		requestAnimationFrame( render );
		cube.rotation.x += 0.01;
		cube.rotation.y += 0.01;
		if ( camera.position.z > 15 || camera.position.z < 1 ) {
			speedCam = -speedCam;
		}
		camera.position.z += speedCam;
		renderer.render( scene, camera );
	}
	render();
}( window.witchr = window.witchr || {} ));