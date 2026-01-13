import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class SceneSetup {
  constructor(container) {
    this.container = container;

    // ===== Scene =====
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    // ===== Camera (아이소메트릭 느낌: Orthographic) =====
    const { w, h } = this.#getSize();
    this.viewSize = 150; // 화면 줌/시야 크기(값이 커질수록 더 넓게 보임)
    this.camera = this.#createOrthoCamera(w, h);

    // 아이소메트릭 각도(대각 + 위에서)
    this.camera.position.set(0, 180, 180);
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 1, 0);

    // ===== Renderer =====
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;

    container.appendChild(this.renderer.domElement);

    // ===== Lights =====
    // (StandardMaterial이 어두워 보일 수 있어 기본 광량을 조금 올림)
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(120, 200, 80);
    dir.castShadow = true;

    // 그림자 범위 확장(전장 크기 커도 깔끔하게)
    dir.shadow.camera.left = -250;
    dir.shadow.camera.right = 250;
    dir.shadow.camera.top = 250;
    dir.shadow.camera.bottom = -250;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 500;
    dir.shadow.mapSize.set(2048, 2048);

    this.scene.add(dir);

    // ===== Ground (평행사변형 전장) =====
    this.#addParallelogramBattlefield();

    // Resize
    window.addEventListener('resize', () => this.#onResize());
  }

  #createOrthoCamera(w, h) {
    const aspect = w / h;
    const halfH = this.viewSize * 0.5;
    const halfW = halfH * aspect;

    const cam = new THREE.OrthographicCamera(
      -halfW, halfW,
      halfH, -halfH,
      0.1, 2000
    );
    return cam;
  }

  #addParallelogramBattlefield() {
    const W = 320;    // 전장 가로(월드)
    const H = 160;    // 전장 세로(월드)
    const SKEW = 80;  // 윗변을 옆으로 민 정도(평행사변형 기울기)

    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, -H / 2);
    shape.lineTo(W / 2, -H / 2);
    shape.lineTo(W / 2 + SKEW, H / 2);
    shape.lineTo(-W / 2 + SKEW, H / 2);
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2); // XZ 평면으로 눕힘

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2f8f2f,
      roughness: 1.0,
      metalness: 0.0,
    });

    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    ground.position.y = 0;
    this.scene.add(ground);

    // 테두리(전장 형태가 더 잘 보이게)
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: 0.55 })
    );
    line.position.copy(ground.position);
    this.scene.add(line);
  }

  #getSize() {
    const w = this.container?.clientWidth || window.innerWidth;
    const h = this.container?.clientHeight || window.innerHeight;
    return { w, h };
  }

  #onResize() {
    const { w, h } = this.#getSize();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Orthographic 카메라 재계산
    const aspect = w / h;
    const halfH = this.viewSize * 0.5;
    const halfW = halfH * aspect;

    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }
}
