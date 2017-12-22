'use strict';
// Ray Tracing & Photon Mapping JS Port
// Based solely on Grant Schindler, 2007
// https://www.cc.gatech.edu/~phlosoft/photon/

// ----- Scene Description -----
const szImg = 512;                  //Image Size
const nrTypes = 2;                  //2 Object Types (Sphere = 0, Plane = 1)
const nrObjects = [2,5];          //2 Spheres, 5 Planes
const gAmbient = 0.1;             //Ambient Lighting
const gOrigin = [0.0,0.0,0.0];  //World Origin for Convenient Re-Use Below (Constant)
const Light = [0.0,1.2,3.75];   //Point Light-Source Position
const spheres = [[1.0,0.0,4.0,0.5],[-0.6,-1.0,4.5,0.5]];         //Sphere Center & Radius
const planes  = [[0, 1.5],[1, -1.5], [0, -1.5], [1, 1.5], [2,5.0]]; //Plane Axis & Distance-to-Origin

// ----- Photon Mapping -----
const nrPhotons = 1000;             //Number of Photons Emitted
const nrBounces = 4;                //Number of Times Each Photon Bounces
let lightPhotons = true;      //Enable Photon Lighting?
const sqRadius = 0.7;             //Photon Integration Area (Squared for Efficiency)
const exposure = 50.0;            //Number of Photons Integrated at Brightest Pixel
let numPhotons = [[0,0], [0,0,0,0,0]];              //Photon Count for Each Scene Object
let photons = []; //Allocated Memory for Per-Object Photon Info

// ----- Raytracing Globals -----
let gIntersect = false;       //For Latest Raytracing Call... Was Anything Intersected by the Ray?
let gType = 0;                        //... Type of the Intersected Object (Sphere or Plane)
let gIndex = 0;                       //... Index of the Intersected Object (Which Sphere/Plane Was It?)
let gSqDist, gDist = -1.0;      //... Distance from Ray Origin to Intersection
let gPoint = [0.0, 0.0, 0.0]; //... Point At Which the Ray Intersected the Object

//---------------------------------------------------------------------------------------
//Ray-Geometry Intersections  -----------------------------------------------------------
//---------------------------------------------------------------------------------------

function sq(n) { return n*n; }
function sqrt(n) { return Math.sqrt(n); }

function raySphere(idx, r, o) //Ray-Sphere Intersection: r=Ray Direction, o=Ray Origin
{
	let s = sub3(spheres[idx],o);  //s=Sphere Center Translated into Coordinate Frame of Ray Origin
	let radius = spheres[idx][3];    //radius=Sphere Radius

	//Intersection of Sphere and Line     =       Quadratic Function of Distance
	let A = dot3(r,r);                       // Remember This From High School? :
	let B = -2.0 * dot3(s,r);                //    A x^2 +     B x +               C  = 0
	let C = dot3(s,s) - sq(radius);          // (r'r)x^2 - (2s'r)x + (s's - radius^2) = 0
	let D = B*B - 4*A*C;                     // Precompute Discriminant

	if (D > 0.0) {                              //Solution Exists only if sqrt(D) is Real (not Imaginary)
		let sign = (C < -0.00001) ? 1 : -1;    //Ray Originates Inside Sphere If C < 0
		let lDist = (-B + sign*sqrt(D))/(2*A); //Solve Quadratic Equation for Distance to Intersection
		checkDistance(lDist,0,idx); //Is This Closest Intersection So Far?
	}
}

function rayPlane(idx, r, o){ //Ray-Plane Intersection
	let axis = planes[idx][0];            //Determine Orientation of Axis-Aligned Plane
	if (r[axis] !== 0.0) {                        //Parallel Ray -> No Intersection
		let lDist = (planes[idx][1] - o[axis]) / r[axis]; //Solve Linear Equation (rx = p-o)
		checkDistance(lDist,1,idx);
	}
}

function rayObject(type, idx, r, o) {
	if (type === 0)
		raySphere(idx,r,o);
	else
		rayPlane(idx,r,o);
}

function checkDistance(lDist, p, i) {
	if (lDist < gDist && lDist > 0.0) { //Closest Intersection So Far in Forward Direction of Ray?
		gType = p; //Save Intersection in Global State
		gIndex = i;
		gDist = lDist;
		gIntersect = true;
	}
}

//---------------------------------------------------------------------------------------
// Lighting -----------------------------------------------------------------------------
//---------------------------------------------------------------------------------------

function lightDiffuse(n, p){  //Diffuse Lighting at Point P with Surface Normal N
	let l = normalize3(sub3(Light, p)); //Light Vector (Point to Light)
	return dot3(n, l);                        //Dot Product = cos (Light-to-Surface-Normal Angle)
}

function sphereNormal(idx, p) {
	return normalize3(sub3(p, spheres[idx])); //Surface Normal (Center to Point)
}

function planeNormal(idx, p, o){
	let axis = planes[idx][0];
	let n = [0, 0, 0];
	n[axis] = o[axis] - planes[idx][1];      //Vector From Surface to Light
	return normalize3(n);
}

function surfaceNormal(type, index, p, inside) {
	if (type === 0) {
		return sphereNormal(index, p);
	} else {
		return planeNormal(index, p, inside);
	}
}

function lightObject(type, idx, p, ambient) {
	let i = lightDiffuse(surfaceNormal(type, idx, p, Light), p);
	return Math.min(1.0, Math.max(i, ambient));   //Add in Ambient Light by Constraining Min Value
}

//---------------------------------------------------------------------------------------
// Raytracing ---------------------------------------------------------------------------
//---------------------------------------------------------------------------------------

function raytrace(ray, origin)
{
	gIntersect = false; //No Intersections Along This Ray Yet
	gDist = 999999.9;   //Maximum Distance to Any Object

	for (let t = 0; t < nrTypes; t++)
	for (let i = 0; i < nrObjects[t]; i++)
		rayObject(t,i,ray,origin);
}

function computePixelColor(x, y) {
	let rgb = [0, 0, 0];
	let ray = [
		x/szImg - 0.5 ,       //Convert Pixels to Image Plane Coordinates
		-(y/szImg - 0.5), 1.0]; //Focal Length = 1.0
	raytrace(ray, gOrigin);                //Raytrace!!! - Intersected Objects are Stored in Global State

	if (gIntersect) {                       //Intersection
		gPoint = mul3c(ray,gDist);           //3D Point of Intersection

		if (gType === 0 && gIndex === 1) {      //Mirror Surface on This Specific Object
			ray = reflect(ray,gOrigin);        //Reflect Ray Off the Surface
			raytrace(ray, gPoint);             //Follow the Reflected Ray
			if (gIntersect) {
				gPoint = add3(mul3c(ray,gDist), gPoint);
			}
		} //3D Point of Intersection

		if (lightPhotons) {                   //Lighting via Photon Mapping
			rgb = gatherPhotons(gPoint,gType,gIndex);
		} else {                                //Lighting via Standard Illumination Model (Diffuse + Ambient)
			let tType = gType, tIndex = gIndex;//Remember Intersected Object
			let i = gAmbient;                //If in Shadow, Use Ambient Color of Original Object
			raytrace(sub3(gPoint,Light), Light);  //Raytrace from Light to Object
			if (tType === gType && tIndex === gIndex) //Ray from Light->Object Hits Object First?
				i = lightObject(gType, gIndex, gPoint, gAmbient); //Not In Shadow - Compute Lighting
			rgb[0]=i; rgb[1]=i; rgb[2]=i;
			rgb = getColor(rgb,tType,tIndex);
		}
	}
	return rgb;
}

function reflect(ray, fromPoint) {                //Reflect Ray
	let n = surfaceNormal(gType, gIndex, gPoint, fromPoint);  //Surface Normal
	return normalize3(sub3(ray, mul3c(n, (2 * dot3(ray,n)))));     //Approximation to Reflection
}

//---------------------------------------------------------------------------------------
//Photon Mapping ------------------------------------------------------------------------
//---------------------------------------------------------------------------------------

function gatherPhotons(p, type, id) {
	let energy = [0, 0, 0];
	let N = surfaceNormal(type, id, p, gOrigin);                   //Surface Normal at Current Point
	for (let i = 0; i < numPhotons[type][id]; i++) {                    //Photons Which Hit Current Object
		if (gatedSqDist3(p,photons[type][id][i][0],sqRadius)) {           //Is Photon Close to Point?
			let weight = Math.max(0.0, -dot3(N, photons[type][id][i][1] ));   //Single Photon Diffuse Lighting
			weight *= (1.0 - sqrt(gSqDist)) / exposure;                    //Weight by Photon-Point Distance
			energy = add3(energy, mul3c(photons[type][id][i][2], weight)); //Add Photon's Energy to Total
		}
	}
	return energy;
}

function emitPhotons() {
	// randomSeed(0);                               //Ensure Same Photons Each Time
	for (let t = 0; t < nrTypes; t++)            //Initialize Photon Count to Zero for Each Object
	for (let i = 0; i < nrObjects[t]; i++)
	numPhotons[t][i] = 0;

	for (let i = 0; i < (view3D ? nrPhotons * 3.0 : nrPhotons); i++){ //Draw 3x Photons For Usability
		let bounces = 1;
		let rgb = [1, 1, 1];               //Initial Photon Color is White
		let ray = normalize3( rand3(1.0) );    //Randomize Direction of Photon Emission
		let prevPoint = Light;                 //Emit From Point Light Source

		//Spread Out Light Source, But Don't Allow Photons Outside Room/Inside Sphere
		while (prevPoint[1] >= Light[1]) {
			prevPoint = add3(Light, mul3c(normalize3(rand3(1.0)), 0.75));
		}
		if (Math.abs(prevPoint[0]) > 1.5 || Math.abs(prevPoint[1]) > 1.2 ||
			gatedSqDist3(prevPoint,spheres[0],spheres[0][3]*spheres[0][3])) bounces = nrBounces+1;

		raytrace(ray, prevPoint);                          //Trace the Photon's Path

		while (gIntersect && bounces <= nrBounces) {        //Intersection With New Object
			gPoint = add3(mul3c(ray,gDist), prevPoint);   //3D Point of Intersection
			rgb = mul3c(getColor(rgb, gType, gIndex), 1.0/Math.sqrt(bounces));
			storePhoton(gType, gIndex, gPoint, ray, rgb);  //Store Photon Info
			drawPhoton(rgb, gPoint);                       //Draw Photon
			shadowPhoton(ray);                             //Shadow Photon
			ray = reflect(ray,prevPoint);                  //Bounce the Photon
			raytrace(ray, gPoint);                         //Trace It to Next Location
			prevPoint = gPoint;
			bounces++;}
	}
}

function storePhoton(type, id, location, direction, energy) {
	if (!photons[type]) photons[type] = [];
	if (!photons[type][id]) photons[type][id] = [];
	let p = numPhotons[type][id];
	photons[type][id][p] = [location, direction, energy];
	numPhotons[type][id]++;
}

function shadowPhoton(ray) {                               //Shadow Photons
	let shadow = [-0.25,-0.25,-0.25];
	let tPoint = gPoint;
	let tType = gType, tIndex = gIndex;                         //Save State
	let bumpedPoint = add3(gPoint,mul3c(ray,0.00001));      //Start Just Beyond Last Intersection
	raytrace(ray, bumpedPoint);                                 //Trace to Next Intersection (In Shadow)
	let shadowPoint = add3(mul3c(ray,gDist), bumpedPoint); //3D Point
	storePhoton(gType, gIndex, shadowPoint, ray, shadow);
	gPoint = tPoint; gType = tType; gIndex = tIndex;            //Restore State
}

function filterColor(rgbIn, r, g, b) { //e.g. White Light Hits Red Wall
	let rgbOut = [r, g, b];
	for (let c=0; c<3; c++)
		rgbOut[c] = Math.min(rgbOut[c],rgbIn[c]); //Absorb Some Wavelengths (R,G,B)
	return rgbOut;
}

function getColor(rgbIn, type, index){ //Specifies Material Color of Each Object
	if (type === 1 && index === 0) {
		return filterColor(rgbIn, 0.0, 1.0, 0.0);
	} else if (type === 1 && index === 2) {
		return filterColor(rgbIn, 1.0, 0.0, 0.0);
	} else {
		return filterColor(rgbIn, 1.0, 1.0, 1.0);
	}
}

//---------------------------------------------------------------------------------------
//Vector Operations ---------------------------------------------------------------------
//---------------------------------------------------------------------------------------

function normalize3(v){        //Normalize 3-Vector
	const l = Math.sqrt(dot3(v,v));
	return mul3c(v, 1.0 / l);
}

function sub3(a, b) {   //Subtract 3-Vectors
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add3(a, b) {   //Add 3-Vectors
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function mul3c(a, c) {    //Multiply 3-Vector with Scalar
	return [c*a[0], c*a[1], c*a[2]];
}

function dot3(a, b) {     //Dot Product 3-Vectors
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function random(min, max) {
	return min + Math.random()*(max - min);
}

function rand3(s) {               //Random 3-Vector
	return [random(-s,s),random(-s,s),random(-s,s)];
}

function gatedSqDist3(a, b, sqradius) { //Gated Squared Distance
	let c = a[0] - b[0];          //Efficient When Determining if Thousands of Points
	let d = c*c;                  //Are Within a Radius of a Point (and Most Are Not!)
	if (d > sqradius) return false; //Gate 1 - If this dimension alone is larger than
	c = a[1] - b[1];                //         the search radius, no need to continue
	d += c*c;
	if (d > sqradius) return false; //Gate 2
	c = a[2] - b[2];
	d += c*c;
	if (d > sqradius) return false; //Gate 3
	gSqDist = d;      return true ; //Store Squared Distance Itself in Global State
}

//---------------------------------------------------------------------------------------
// User Interaction and Display ---------------------------------------------------------
//---------------------------------------------------------------------------------------
let empty = true, view3D = false; //Stop Drawing, Switch Views
let pRow = 0, pCol = 0, pIteration = 0, pMax = 0;     //Pixel Rendering Order
function odd(x) { return x % 2 !== 0; }

function setup() {
	emitPhotons();
	resetRender();
	drawInterface();
}

function draw() {
	if (view3D){
		if (empty) {
			gfx.stroke(0);
			gfx.fill(0);
			gfx.rect(0,0,szImg-1,szImg-1); //Black Out Drawing Area
			emitPhotons(); empty = false;
		}
	} //Emit & Draw Photons
	else {
		if (empty)
			render();
	}
}

function drawInterface() {
	let img1 = "1_32.png", img2 = "2_32.png", img3 = "3_32.png";
	gfx.stroke(221,221,204);
	gfx.fill(221,221,204);
	gfx.rect(0,szImg,szImg,48); //Fill Background with Page Color

	if (!view3D) {
		gfx.fill(0);
		img3 = "gray_" + img3;
	}
	else {
		gfx.fill(160);
	}

	gfx.text("Ray Tracing", 64, szImg + 28);
	if (lightPhotons || view3D) {
		gfx.fill(0);
		img1 = "gray_" + img1;
	} else {
		gfx.fill(160);
	}

	gfx.text("Photon Mapping", 368, szImg + 28);
	if (!lightPhotons || view3D)
		img2 = "gray_" + img2;

	gfx.stroke(0);
	gfx.fill(255);  //Draw Buttons with Icons
	gfx.rect(198,519,33,33);
	gfx.image(img1,199,520);
	gfx.rect(240,519,33,33);
	gfx.image(img2,241,520);
	gfx.rect(282,519,33,33);
	gfx.image(img3,283,520);
}

function render() { //Render Several Lines of Pixels at Once Before Drawing
	let x,y,iterations = 0;
	let rgb = [0.0,0.0,0.0];

	while (iterations < (mouseDragging ? 1024 : Math.max(pMax, 256) )) {

		//Render Pixels Out of Order With Increasing Resolution: 2x2, 4x4, 16x16... 512x512
		if (pCol >= pMax) {
			pRow++;
			pCol = 0;
			if (pRow >= pMax) {
				pIteration++;
				pRow = 0;
				pMax = Math.pow(2, pIteration);
			}
		}
		let pNeedsDrawing = (pIteration === 1 || odd(pRow) || (!odd(pRow) && odd(pCol)));
		x = pCol * (szImg/pMax); y = pRow * (szImg/pMax);
		pCol++;

		if (pNeedsDrawing) {
			iterations++;
			rgb = mul3c( computePixelColor(x,y), 255.0);               //All the Magic Happens in Here!

			gfx.stroke(rgb[0],rgb[1],rgb[2]);
			gfx.fill(rgb[0],rgb[1],rgb[2]);  //Stroke & Fill
			gfx.rect(x,y,(szImg/pMax)-1,(szImg/pMax)-1);                  //Draw the Possibly Enlarged Pixel
		}
	}
	if (pRow === szImg-1) empty = false;
}

function resetRender() { //Reset Rendering Variables
	pRow=0;
	pCol=0;
	pIteration=1;
	pMax=2;
	empty=true;
	if (lightPhotons && !view3D)
		emitPhotons();
}

function drawPhoton(rgb, p) {           //Photon Visualization
	if (view3D && p[2] > 0.0){                       //Only Draw if In Front of Camera
		let x = (szImg/2) + ((szImg *  p[0]/p[2])|0); //Project 3D Points into Scene
		let y = (szImg/2) + ((szImg * -p[1]/p[2])|0); //Don't Draw Outside Image
		if (y <= szImg) {
			gfx.stroke(255.0*rgb[0],255.0*rgb[1],255.0*rgb[2]);
			gfx.point(x, y);
		}
	}
}

//---------------------------------------------------------------------------------------
//Mouse and Keyboard Interaction --------------------------------------------------------
//---------------------------------------------------------------------------------------
let prevMouseX = -9999, prevMouseY = -9999, sphereIndex = -1;
let mouseX = 0, mouseY = 0;
let s = 130.0; //Arbitary Constant Through Experimentation
let mouseDragging = false;

function mouseReleased() {
	prevMouseX = -9999;
	prevMouseY = -9999;
	mouseDragging = false;
}

function mousePressed() {
	sphereIndex = 2; //Click Spheres
	let mouse3 = [(mouseX - szImg/2)/s, -(mouseY - szImg/2)/s, 0.5*(spheres[0][2] + spheres[1][2])];
	if (gatedSqDist3(mouse3,spheres[0],spheres[0][3])) sphereIndex = 0;
	else if (gatedSqDist3(mouse3,spheres[1],spheres[1][3])) sphereIndex = 1;
	if (mouseY > szImg) switchToMode('0', mouseX); //Click Buttons
}

function constrain(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function mouseDragged() {
	if (prevMouseX > -9999 && sphereIndex > -1){
		if (sphereIndex < nrObjects[0]){ //Drag Sphere
			spheres[sphereIndex][0] += (mouseX - prevMouseX)/s;
			spheres[sphereIndex][1] -= (mouseY - prevMouseY)/s;
		} else { //Drag Light
			Light[0] += (mouseX - prevMouseX)/s; Light[0] = constrain(Light[0],-1.4,1.4);
			Light[1] -= (mouseY - prevMouseY)/s; Light[1] = constrain(Light[1],-0.4,1.2);
		}
		resetRender();
	}
	prevMouseX = mouseX;
	prevMouseY = mouseY;
	mouseDragging = true;
}

function switchToMode(i, x) { // Switch Between Raytracing, Photon Mapping Views
	if (i === '1' || x<230) {
		view3D = false;
		lightPhotons = false;
		resetRender();
		drawInterface();
	}
	else if (i ==='2' || x<283) {
		view3D = false;
		lightPhotons = true;
		resetRender();
		drawInterface();
	}
	else if (i ==='3' || x<513) {
		view3D = true;
		resetRender();
		drawInterface();
	}
}



