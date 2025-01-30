import { useEffect, useRef } from "react";
import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module.js";
import RAPIER from "@dimforge/rapier3d-compat";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const BallGame = () => {
  const threeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let width = window.innerWidth;
    let height = window.innerHeight;
    let world: RAPIER.World;
    const dynamicBodies: [THREE.Object3D, RAPIER.RigidBody][] = [];

    const setupThreeJS = () => {
      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xe5e4e2);

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.VSMShadowMap;

      if (threeRef.current) {
        threeRef.current.appendChild(renderer.domElement);
      }

      // Camera setup
      const camera = new THREE.PerspectiveCamera(55, width / height, 0.5, 100);
      camera.position.set(0, 12, 4);
      camera.lookAt(0, 0, 0);

      // new OrbitControls(camera, renderer.domElement);
      // Lights
      const light = new THREE.AmbientLight(0xffffff, 1);
      scene.add(light);

      const spotlight = new THREE.SpotLight();
      spotlight.position.set(0, 3, 4);
      spotlight.castShadow = true;
      scene.add(spotlight);

      // Ball setup
      const ballGeometry = new THREE.SphereGeometry(0.5, 32, 32);
      const ballMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        metalness: 0.7,
        roughness: 0.7,
      });
      const ball = new THREE.Mesh(ballGeometry, ballMaterial);
      ball.castShadow = true;
      ball.position.set(0, 0.6, 2);
      scene.add(ball);

      // Create ball physics body
      const ballBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.6, 2)
      );
      const ballShape = RAPIER.ColliderDesc.ball(0.5)
        .setMass(1)
        .setRestitution(0.8);
      world.createCollider(ballShape, ballBody);
      dynamicBodies.push([ball, ballBody]);

      // Plane (ground)
      const planeGeometry = new THREE.PlaneGeometry(10, 10);
      const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0xffbf00,
        metalness: 0.7,
        roughness: 0.7,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.rotateX(-Math.PI / 2);
      plane.receiveShadow = true;
      scene.add(plane);

      // Plane physics
      const planeBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0)
      );
      const planeShape = RAPIER.ColliderDesc.cuboid(5, 0.5, 5);
      world.createCollider(planeShape, planeBody);

      // Walls
      const wallGeometry = new THREE.BoxGeometry(10, 1, 0.3);
      const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.7,
        roughness: 0.7,
      });

      const walls = [
        { x: 4.85, y: 0.5, z: 0, rotY: Math.PI / 2 }, // Right
        { x: -4.85, y: 0.5, z: 0, rotY: Math.PI / 2 }, // Left
        { x: 0, y: 0.5, z: -4.85, rotY: 0 }, // Bottom
        { x: 0, y: 0.5, z: 4.85, rotY: 0 }, // Top
      ];

      walls.forEach(({ x, y, z, rotY }) => {
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(x, y, z);
        wall.rotation.y = rotY;
        wall.castShadow = true;
        scene.add(wall);
        // Create Rapier physics body
        const wallBody = world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z) // Set correct position
        );
        let wallShape;
        if (rotY === Math.PI / 2) {
          wallShape = RAPIER.ColliderDesc.cuboid(0.5, 5, 5); // Adjust size if needed
        } else {
          wallShape = RAPIER.ColliderDesc.cuboid(5, 0.5, 0.15);
        }
        world.createCollider(wallShape, wallBody);
      });

      //Stats
      const stats = new Stats();
      document.body.appendChild(stats.dom);

      // Mouse Drag Logic
      const velocity = { x: 0, z: 0 };
      let isDragging = false;
      let lastMousePos = { x: 0, z: 0 };
      const friction = 0;

      const onMouseDown = (event: MouseEvent) => {
        isDragging = true;
        lastMousePos = { x: event.clientX, z: event.clientY };
        velocity.x = 0;
        velocity.z = 0;
      };

      const onMouseMove = (event: MouseEvent) => {
        if (!isDragging) return;
        const dx = (event.clientX - lastMousePos.x) * 0.02;
        const dz = (event.clientY - lastMousePos.z) * 0.02;
        if (ballBody) {
          const translation = ballBody.translation();
          ballBody.setTranslation(
            { x: translation.x + dx, y: translation.y, z: translation.z + dz },
            true
          );
        }
        lastMousePos = { x: event.clientX, z: event.clientY };
      };

      const onMouseUp = (event: MouseEvent) => {
        isDragging = false;

        const impulseX = (event.clientX - lastMousePos.x) * 0.5;
        const impulseZ = (event.clientY - lastMousePos.z) * 0.5;

        if (ballBody) {
          ballBody.applyImpulse(
            { x: (impulseX - 30), y: 0, z: (impulseZ - 30) },
            true
          );
        }
      };

      window.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        if (!isDragging) {
          ball.position.x += (velocity.x + 2);
          ball.position.z += (velocity.z + 2);
          velocity.x *= friction;
          velocity.z *= friction;
        }

        world.step(); // Update physics world
        dynamicBodies.forEach(([obj, body]) => {
          obj.position.copy(body.translation());
          obj.quaternion.copy(body.rotation());
        });

        renderer.render(scene, camera);
        stats.update();
      };

      animate();

      return () => {
        window.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        renderer.dispose();
      };
    };

    const initializePhysics = async () => {
      await RAPIER.init();
      world = new RAPIER.World(new RAPIER.Vector3(0.0, -9.81, 0.0));
      setupThreeJS();
    };

    initializePhysics();

    return () => {};
  }, []);

  return <div ref={threeRef}></div>;
};

export default BallGame;
