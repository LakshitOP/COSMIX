// ================================================================
// ORBITAL — MAIN.JS
// Navbar + Three.js orbital visualization
// ================================================================


// ================================================================
// NAVBAR SCROLL STATE
// ================================================================

const header = document.getElementById("header");

if (header) {
    window.addEventListener(
        "scroll",
        () => {
            header.classList.toggle(
                "scrolled",
                window.scrollY > 12
            );
        },
        { passive: true }
    );
}




// ================================================================
// THREE.JS ORBITAL EARTH SCENE
// ================================================================

(function () {

    const canvas =
        document.getElementById("earth-canvas");

    const heroSection =
        document.querySelector(".hero");

    const popover =
        document.getElementById("hero-popover");


    // Safety check
    if (
        !canvas ||
        !heroSection ||
        !popover ||
        typeof THREE === "undefined"
    ) {
        console.error(
            "ORBITAL: Three.js scene could not initialize."
        );

        return;
    }


    // ============================================================
    // SCENE
    // ============================================================

    const scene =
        new THREE.Scene();


    const camera =
        new THREE.PerspectiveCamera(
            42,
            heroSection.clientWidth /
                heroSection.clientHeight,
            0.1,
            1000
        );


    camera.position.set(
        0,
        0.4,
        8.2
    );


    const renderer =
        new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });


    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio,
            2
        )
    );


    renderer.setSize(
        heroSection.clientWidth,
        heroSection.clientHeight
    );


    const ACCENT =
        0x8fb4ff;



    // ============================================================
    // STARFIELD
    // ============================================================

    function makeStars(
        count,
        radius,
        size,
        opacity
    ) {

        const positions =
            new Float32Array(
                count * 3
            );


        for (
            let i = 0;
            i < count;
            i++
        ) {

            const r =
                radius *
                (
                    0.7 +
                    Math.random() * 0.3
                );


            const theta =
                Math.random() *
                Math.PI *
                2;


            const phi =
                Math.acos(
                    (
                        Math.random() * 2
                    ) - 1
                );


            positions[i * 3] =
                r *
                Math.sin(phi) *
                Math.cos(theta);


            positions[i * 3 + 1] =
                r *
                Math.sin(phi) *
                Math.sin(theta);


            positions[i * 3 + 2] =
                r *
                Math.cos(phi);

        }


        const geo =
            new THREE.BufferGeometry();


        geo.setAttribute(
            "position",
            new THREE.BufferAttribute(
                positions,
                3
            )
        );


        const mat =
            new THREE.PointsMaterial({
                color: 0xffffff,
                size: size,
                transparent: true,
                opacity: opacity,
                sizeAttenuation: true
            });


        return new THREE.Points(
            geo,
            mat
        );
    }


    scene.add(
        makeStars(
            2200,
            60,
            0.06,
            0.55
        )
    );


    scene.add(
        makeStars(
            500,
            30,
            0.1,
            0.4
        )
    );



    // ============================================================
    // PROCEDURAL EARTH TEXTURE
    // ============================================================

    function makeEarthTexture() {

        const width = 1024;
        const height = 512;


        const textureCanvas =
            document.createElement(
                "canvas"
            );


        textureCanvas.width =
            width;

        textureCanvas.height =
            height;


        const ctx =
            textureCanvas.getContext(
                "2d"
            );


        // --------------------------------------------------------
        // Ocean
        // --------------------------------------------------------

        const gradient =
            ctx.createLinearGradient(
                0,
                0,
                0,
                height
            );


        gradient.addColorStop(
            0,
            "#0c1526"
        );


        gradient.addColorStop(
            0.5,
            "#0a1220"
        );


        gradient.addColorStop(
            1,
            "#080e19"
        );


        ctx.fillStyle =
            gradient;


        ctx.fillRect(
            0,
            0,
            width,
            height
        );


        // --------------------------------------------------------
        // Landmass helper
        // --------------------------------------------------------

        function blob(
            cx,
            cy,
            r,
            points
        ) {

            ctx.beginPath();


            for (
                let i = 0;
                i <= points;
                i++
            ) {

                const angle =
                    (
                        i / points
                    ) *
                    Math.PI *
                    2;


                const rr =
                    r *
                    (
                        0.72 +
                        Math.random() * 0.5
                    );


                const x =
                    cx +
                    Math.cos(angle) *
                    rr;


                const y =
                    cy +
                    Math.sin(angle) *
                    rr *
                    0.65;


                if (i === 0) {

                    ctx.moveTo(
                        x,
                        y
                    );

                } else {

                    ctx.lineTo(
                        x,
                        y
                    );

                }

            }


            ctx.closePath();
        }


        // --------------------------------------------------------
        // Landmasses
        // --------------------------------------------------------

        ctx.fillStyle =
            "#1a2436";


        const seeds = [

            [175, 150, 95],
            [145, 230, 60],
            [230, 150, 70],
            [255, 240, 55],

            [430, 160, 110],
            [470, 250, 55],
            [520, 320, 70],

            [640, 150, 80],
            [700, 220, 100],
            [760, 300, 60],

            [830, 170, 70],
            [880, 260, 55],
            [300, 330, 60],
            [560, 120, 50]

        ];


        seeds.forEach(
            ([x, y, r]) => {

                blob(
                    x,
                    y,
                    r,
                    10
                );

            }
        );


        ctx.fillStyle =
            "#212d42";


        seeds.forEach(
            ([x, y, r]) => {

                blob(
                    x + 6,
                    y + 4,
                    r * 0.55,
                    8
                );

            }
        );


        // --------------------------------------------------------
        // Subtle texture noise
        // --------------------------------------------------------

        const image =
            ctx.getImageData(
                0,
                0,
                width,
                height
            );


        for (
            let i = 0;
            i < image.data.length;
            i += 4
        ) {

            const noise =
                (
                    Math.random() - 0.5
                ) * 6;


            image.data[i] +=
                noise;

            image.data[i + 1] +=
                noise;

            image.data[i + 2] +=
                noise;

        }


        ctx.putImageData(
            image,
            0,
            0
        );


        const texture =
            new THREE.CanvasTexture(
                textureCanvas
            );


        texture.needsUpdate =
            true;


        return texture;
    }



    // ============================================================
    // EARTH
    // ============================================================

    const earthGroup =
        new THREE.Group();


    scene.add(
        earthGroup
    );


    const EARTH_R = 2.0;


    const earthGeometry =
        new THREE.SphereGeometry(
            EARTH_R,
            64,
            64
        );


    const earthMaterial =
        new THREE.MeshPhongMaterial({

            map:
                makeEarthTexture(),

            specular:
                new THREE.Color(
                    0x223047
                ),

            shininess:
                6

        });


    const earthMesh =
        new THREE.Mesh(
            earthGeometry,
            earthMaterial
        );


    earthGroup.add(
        earthMesh
    );



    // ============================================================
    // ATMOSPHERE GLOW
    // ============================================================

    const atmosphereGeometry =
        new THREE.SphereGeometry(
            EARTH_R * 1.045,
            64,
            64
        );


    const atmosphereMaterial =
        new THREE.ShaderMaterial({

            uniforms: {

                glowColor: {
                    value:
                        new THREE.Color(
                            ACCENT
                        )
                }

            },


            vertexShader: `

                varying float intensity;

                void main() {

                    vec3 vNormal =
                        normalize(
                            normalMatrix *
                            normal
                        );

                    vec3 vNormel =
                        normalize(
                            normalMatrix *
                            vec3(
                                0.0,
                                0.0,
                                1.0
                            )
                        );

                    intensity =
                        pow(
                            0.62 -
                            dot(
                                vNormal,
                                vNormel
                            ),
                            2.8
                        );

                    gl_Position =
                        projectionMatrix *
                        modelViewMatrix *
                        vec4(
                            position,
                            1.0
                        );

                }

            `,


            fragmentShader: `

                uniform vec3 glowColor;

                varying float intensity;

                void main() {

                    gl_FragColor =
                        vec4(
                            glowColor,
                            1.0
                        ) *
                        intensity *
                        0.85;

                }

            `,


            side:
                THREE.BackSide,

            blending:
                THREE.AdditiveBlending,

            transparent:
                true

        });


    const atmosphere =
        new THREE.Mesh(
            atmosphereGeometry,
            atmosphereMaterial
        );


    earthGroup.add(
        atmosphere
    );



    // ============================================================
    // LIGHTING
    // ============================================================

    scene.add(
        new THREE.AmbientLight(
            0x2a3550,
            1.1
        )
    );


    const sun =
        new THREE.DirectionalLight(
            0xfdf6ea,
            1.25
        );


    sun.position.set(
        -5,
        2.4,
        4
    );


    scene.add(
        sun
    );


    const rim =
        new THREE.DirectionalLight(
            0x6f8fd6,
            0.4
        );


    rim.position.set(
        4,
        -1,
        -3
    );


    scene.add(
        rim
    );



    // ============================================================
    // ORBIT RINGS
    // ============================================================

    const orbitDefs = [

        {
            r:
                EARTH_R * 1.32,

            incl:
                0.35,

            rot:
                0.1,

            opacity:
                0.16
        },


        {
            r:
                EARTH_R * 1.55,

            incl:
                -0.5,

            rot:
                1.9,

            opacity:
                0.12
        },


        {
            r:
                EARTH_R * 1.8,

            incl:
                1.15,

            rot:
                3.2,

            opacity:
                0.09
        }

    ];


    const orbitGroups = [];


    orbitDefs.forEach(
        (definition) => {

            const ringGeometry =
                new THREE.TorusGeometry(
                    definition.r,
                    0.003,
                    8,
                    128
                );


            const ringMaterial =
                new THREE.MeshBasicMaterial({

                    color:
                        ACCENT,

                    transparent:
                        true,

                    opacity:
                        definition.opacity

                });


            const ring =
                new THREE.Mesh(
                    ringGeometry,
                    ringMaterial
                );


            ring.rotation.x =
                Math.PI / 2 +
                definition.incl;


            ring.rotation.y =
                definition.rot;


            earthGroup.add(
                ring
            );


            orbitGroups.push({

                mesh:
                    ring,

                def:
                    definition

            });

        }
    );



    // ============================================================
    // SATELLITES
    // ============================================================

    const satelliteNames = [

        "ISS (ZARYA)",
        "STARLINK-3021",
        "HUBBLE ST",
        "NOAA-19"

    ];


    const satellites = [];


    orbitDefs.forEach(
        (definition, index) => {

            const geometry =
                new THREE.SphereGeometry(
                    0.028,
                    12,
                    12
                );


            const material =
                new THREE.MeshBasicMaterial({

                    color:
                        0xf4f7ff

                });


            const satellite =
                new THREE.Mesh(
                    geometry,
                    material
                );


            satellite.userData = {

                name:
                    satelliteNames[
                        index %
                        satelliteNames.length
                    ],

                alt:
                    Math.round(
                        380 +
                        index * 260
                    ) + " km",

                vel:
                    (
                        7.1 +
                        index * 0.35
                    ).toFixed(2) +
                    " km/s",

                status:
                    index === 2
                        ? "INACTIVE"
                        : "ACTIVE",

                orbit:
                    definition,

                angle:
                    Math.random() *
                    Math.PI *
                    2,

                speed:
                    0.09 +
                    index * 0.025

            };


            earthGroup.add(
                satellite
            );


            satellites.push(
                satellite
            );

        }
    );



    // ============================================================
    // DEBRIS FIELD
    // ============================================================

    const debrisCount =
        140;


    const debrisGeometry =
        new THREE.BufferGeometry();


    const debrisPositions =
        new Float32Array(
            debrisCount * 3
        );


    const debrisData = [];


    for (
        let i = 0;
        i < debrisCount;
        i++
    ) {

        const radius =
            EARTH_R *
            (
                1.25 +
                Math.random() * 0.7
            );


        const theta =
            Math.random() *
            Math.PI *
            2;


        const y =
            (
                Math.random() -
                0.5
            ) *
            EARTH_R *
            0.9;


        debrisData.push({

            r:
                radius,

            theta:
                theta,

            y:
                y,

            speed:
                0.02 +
                Math.random() * 0.05

        });


        debrisPositions[
            i * 3
        ] =
            Math.cos(theta) *
            radius;


        debrisPositions[
            i * 3 + 1
        ] =
            y;


        debrisPositions[
            i * 3 + 2
        ] =
            Math.sin(theta) *
            radius;

    }


    debrisGeometry.setAttribute(

        "position",

        new THREE.BufferAttribute(
            debrisPositions,
            3
        )

    );


    const debrisMaterial =
        new THREE.PointsMaterial({

            color:
                0x9aa4b8,

            size:
                0.02,

            transparent:
                true,

            opacity:
                0.55

        });


    const debrisPoints =
        new THREE.Points(
            debrisGeometry,
            debrisMaterial
        );


    earthGroup.add(
        debrisPoints
    );



    // ============================================================
    // RAYCASTING / INTERACTION
    // ============================================================

    const raycaster =
        new THREE.Raycaster();


    raycaster.params.Points.threshold =
        0.06;


    const mouseNDC =
        new THREE.Vector2(
            10,
            10
        );


    let hovered =
        null;


    let pinned =
        null;


    let lastClientX =
        0;


    let lastClientY =
        0;



    // ============================================================
    // POPOVER
    // ============================================================

    function updatePopover(
        object,
        clientX,
        clientY
    ) {

        if (!object) {

            popover.classList.remove(
                "show"
            );

            return;
        }


        const data =
            object.userData;


        popover
            .querySelector(
                ".hp-name"
            )
            .textContent =
            data.name;


        const rows =
            popover.querySelectorAll(
                ".hp-row span:last-child"
            );


        rows[0].textContent =
            data.alt;


        rows[1].textContent =
            data.vel;


        rows[2].textContent =
            data.status;


        rows[2].style.color =
            data.status === "ACTIVE"
                ? "var(--safe)"
                : "var(--text-2)";


        const bounds =
            heroSection.getBoundingClientRect();


        let left =
            clientX -
            bounds.left +
            16;


        let top =
            clientY -
            bounds.top -
            20;


        if (
            left + 190 >
            bounds.width
        ) {

            left =
                clientX -
                bounds.left -
                200;

        }


        popover.style.left =
            left + "px";


        popover.style.top =
            top + "px";


        popover.classList.add(
            "show"
        );

    }



    // ============================================================
    // PARALLAX
    // ============================================================

    const parallax = {

        targetX: 0,

        targetY: 0,

        x: 0,

        y: 0

    };



    // ============================================================
    // MOUSE MOVE
    // ============================================================

    canvas.addEventListener(
        "mousemove",
        (event) => {

            const bounds =
                canvas.getBoundingClientRect();


            mouseNDC.x =
                (
                    (
                        event.clientX -
                        bounds.left
                    ) /
                    bounds.width
                ) *
                2 -
                1;


            mouseNDC.y =
                -(
                    (
                        event.clientY -
                        bounds.top
                    ) /
                    bounds.height
                ) *
                2 +
                1;


            lastClientX =
                event.clientX;


            lastClientY =
                event.clientY;


            parallax.targetX =
                mouseNDC.x;


            parallax.targetY =
                mouseNDC.y;

        }
    );



    // ============================================================
    // MOUSE LEAVE
    // ============================================================

    canvas.addEventListener(
        "mouseleave",
        () => {

            mouseNDC.set(
                10,
                10
            );


            parallax.targetX =
                0;


            parallax.targetY =
                0;


            if (!pinned) {

                hovered =
                    null;


                updatePopover(
                    null
                );

            }

        }
    );



    // ============================================================
    // CLICK
    // ============================================================

    canvas.addEventListener(
        "click",
        (event) => {

            if (hovered) {

                pinned =
                    hovered;


                updatePopover(
                    pinned,
                    event.clientX,
                    event.clientY
                );

            } else {

                pinned =
                    null;


                updatePopover(
                    null
                );

            }

        }
    );



    // ============================================================
    // RESIZE
    // ============================================================

    function onResize() {

        const width =
            heroSection.clientWidth;


        const height =
            heroSection.clientHeight;


        camera.aspect =
            width / height;


        camera.updateProjectionMatrix();


        renderer.setSize(
            width,
            height
        );

    }


    window.addEventListener(
        "resize",
        onResize
    );



    // ============================================================
    // ANIMATION
    // ============================================================

    const clock =
        new THREE.Clock();


    function animate() {

        requestAnimationFrame(
            animate
        );


        const elapsed =
            clock.getElapsedTime();


        // --------------------------------------------------------
        // Earth rotation
        // --------------------------------------------------------

        earthMesh.rotation.y =
            elapsed * 0.035;



        // --------------------------------------------------------
        // Satellite movement
        // --------------------------------------------------------

        satellites.forEach(
            (satellite) => {

                const data =
                    satellite.userData;


                data.angle +=
                    data.speed *
                    0.01;


                const localX =
                    Math.cos(
                        data.angle
                    ) *
                    data.orbit.r;


                const localZ =
                    Math.sin(
                        data.angle
                    ) *
                    data.orbit.r;


                const position =
                    new THREE.Vector3(
                        localX,
                        0,
                        localZ
                    );


                const rotationX =
                    new THREE.Matrix4()
                        .makeRotationX(
                            Math.PI / 2 +
                            data.orbit.incl
                        );


                position.applyMatrix4(
                    rotationX
                );


                const rotationY =
                    new THREE.Matrix4()
                        .makeRotationY(
                            data.orbit.rot
                        );


                position.applyMatrix4(
                    rotationY
                );


                satellite.position.copy(
                    position
                );

            }
        );



        // --------------------------------------------------------
        // Debris movement
        // --------------------------------------------------------

        debrisData.forEach(
            (data, index) => {

                data.theta +=
                    data.speed *
                    0.004;


                debrisPositions[
                    index * 3
                ] =
                    Math.cos(
                        data.theta
                    ) *
                    data.r;


                debrisPositions[
                    index * 3 + 2
                ] =
                    Math.sin(
                        data.theta
                    ) *
                    data.r;

            }
        );


        debrisGeometry
            .attributes
            .position
            .needsUpdate =
            true;



        // --------------------------------------------------------
        // Smooth parallax
        // --------------------------------------------------------

        parallax.x +=
            (
                parallax.targetX -
                parallax.x
            ) *
            0.04;


        parallax.y +=
            (
                parallax.targetY -
                parallax.y
            ) *
            0.04;


        camera.position.x =
            parallax.x *
            0.5;


        camera.position.y =
            0.4 +
            parallax.y *
            0.3;


        camera.lookAt(
            0,
            0,
            0
        );



        // --------------------------------------------------------
        // Satellite hover detection
        // --------------------------------------------------------

        if (!pinned) {

            raycaster.setFromCamera(
                mouseNDC,
                camera
            );


            const hits =
                raycaster.intersectObjects(
                    satellites
                );


            if (hits.length) {

                if (
                    hovered !==
                    hits[0].object
                ) {

                    hovered =
                        hits[0].object;


                    document.body.style.cursor =
                        "pointer";

                }


                updatePopover(
                    hovered,
                    lastClientX,
                    lastClientY
                );

            } else if (hovered) {

                hovered =
                    null;


                document.body.style.cursor =
                    "default";


                updatePopover(
                    null
                );

            }

        }



        // --------------------------------------------------------
        // Render
        // --------------------------------------------------------

        renderer.render(
            scene,
            camera
        );

    }


    // Start animation
    animate();


})();