const canvas = document.getElementById("canvas");
const forcePoint = document.getElementById("force-point");
const imgAddButton = document.getElementById("img-add-button");
const charaItemContainer = document.getElementById("chara-item-container");
const particleCountContainer = document.getElementById("particle-count");
const html = document.documentElement;
const ctx = canvas.getContext("2d");
let _x, _y, _c, _f, _t;
let img, imgData, pixelIndex, particleIndex, particleA, prticleB;
let imgURL,
  imgIndex = 0;
let lastX, lastY;
let stats;
let isMouceDownAndNotMove, isMouceDown;
let imgAddIsOpen = false;
let imgAddAnimating = false;
const particleCountWrapper = {
  value: 0,
};
const forceAreaRadius = 25;
const config = {
  // 粒子受到鼠标影响的半径
  forceRadius: 1000,
  // 施力权重
  forceRate: 500,
  // 施力偏移角度
  forceOffsetAngle: 0,
  // 施力点移动模式
  forceMoveMode: "Follow Mouse",
  // 显示施力点
  showForcePoint: true,
  // 粒子自动恢复位置的速度计算权重
  positionReturnRate: 0.05,
  // 粒子颜色转移的速度计算权重
  colorReturnRate: 0.04,
  // 粒子半径
  particleRadius: 5,
  particleShape: "Circle",
  // 绘制粒子需要的RGB颜色总阈值
  particleThreshold: 750,
  // 横向绘制的粒子数量
  particleHorizontalCount: 120,
  // 纵向绘制的粒子数量，之后由横向粒子数量和图片的尺寸推算出来
  _particleVerticalCount: null,
  // 图形的缩放比例
  scaleRate: 10,
  // 显示帧率
  showFrame: false,
  //   行为模式
  behavior: "Follow Click",
  screenShot: () => {
    const a = document.createElement("a");
    a.href = canvas.toDataURL();
    a.download = "pixel-particle.png";
    a.click();
  },
  toggleFullScreen: () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.body.requestFullscreen();
    }
  },
};
html.style.setProperty("--force-area-radius", `${forceAreaRadius}px`);
html.style.setProperty(
  "--force-radius",
  `${config.forceRadius / devicePixelRatio}px`
);
const forcePosition = {
  x: (document.body.clientWidth / 2) * devicePixelRatio,
  y: (document.body.clientHeight / 2) * devicePixelRatio,
};
syncForcePointPosition();
const offset = {
  x: 0,
  y: 0,
};
const imgList = [
  "./images/1.png",
  "./images/2.png",
  "./images/3.png",
  "./images/4.png",
  "./images/5.png",
];
const charaItemList = Array.from(
  charaItemContainer.querySelectorAll(
    ".chara-item:not(.chara-item--highlight):not(.chara-item--add)"
  )
);
const charaItemAdd = charaItemContainer.querySelector(".chara-item--add");
const charaItemHighlight = charaItemContainer.querySelector(
  ".chara-item--highlight"
);
const input = document.createElement("input");
const particleList = [];
class Particle {
  constructor(x, y, ox, oy, color = "rgb(0,0,0)") {
    // 粒子当前的位置
    this.x = x;
    this.y = y;
    // 粒子的目标位置
    this.ox = ox;
    this.oy = oy;
    // 粒子的颜色
    this.color = color;
    this.r = this.or;
    this.g = this.og;
    this.b = this.ob;
    // 粒子的速度
    this.vx = 0;
    this.vy = 0;
  }
  r = 0;
  g = 0;
  b = 0;
  or = 0;
  og = 0;
  ob = 0;
  set color(newColor) {
    const colorList = newColor.replace("rgb(", "").replace(")", "").split(",");
    this.or = Number(colorList[0]);
    this.og = Number(colorList[1]);
    this.ob = Number(colorList[2]);
  }
  get color() {
    return `rgb(${parseInt(this.r)},${parseInt(this.g)},${parseInt(this.b)})`;
  }
  updateColor() {
    this.r += (this.or - this.r) * config.colorReturnRate;
    this.g += (this.og - this.g) * config.colorReturnRate;
    this.b += (this.ob - this.b) * config.colorReturnRate;
  }
  // 绘制函数
  draw() {
    ctx.beginPath();
    ctx.fillStyle = this.color;
    if (config.particleShape === "Circle") {
      ctx.arc(
        this.x + (config.behavior === "Follow Move" ? forcePosition.x : 0),
        this.y + (config.behavior === "Follow Move" ? forcePosition.y : 0),
        config.particleRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();
    } else if (config.particleShape === "Square") {
      ctx.fillRect(
        this.x +
          (config.behavior === "Follow Move" ? forcePosition.x : 0) -
          config.particleRadius / 2,
        this.y +
          (config.behavior === "Follow Move" ? forcePosition.y : 0) -
          config.particleRadius / 2,
        config.particleRadius * 2,
        config.particleRadius * 2
      );
    }
  }
  // 粒子位置的更新函数
  updatePosition() {
    // 粒子的初始速度，根据粒子距离目标位置的距离和回复率来确定
    this.vx = (this.ox - this.x) * config.positionReturnRate;
    this.vy = (this.oy - this.y) * config.positionReturnRate;
    // 考虑指针坐标对粒子运动的影响
    if (
      forcePosition.x !== null &&
      forcePosition.y !== null &&
      config.behavior !== "Follow Move"
    ) {
      _x = this.x - forcePosition.x;
      _y = this.y - forcePosition.y;
      // 粒子距离指针的位置
      _c = Math.sqrt(_x ** 2 + _y ** 2);
      // 判断这个距离是否在上方定义的影响半径forceRadius之内
      if (_c < config.forceRadius) {
        // 这里需要一点物理知识，_f是粒子受到的力，这里的计算方式使用的是反比例函数，有点类似于万有引力的公式，但是又有所不同，因为分母下方是一次的
        _f = config.forceRate / _c;
        //  获取粒子位置到指针位置的角度
        _t = Math.atan2(_y, _x) + (config.forceOffsetAngle / 180) * Math.PI;
        // 进行受力分解，然后将产生的速度添加到原有的速度上
        this.vx += _f * Math.cos(_t);
        this.vy += _f * Math.sin(_t);
      }
    }
    // 检查了半天终于找到了问题
    // 通过速度改变粒子的位置
    this.x += this.vx;
    this.y += this.vy;
  }
}
function loadImg(url) {
  img = new Image();
  img.src = url;
  // 加载完成图片数据后调用
  img.onload = () => {
    // 重制粒子数量索引
    particleIndex = 0;
    // 计算纵向粒子的数量，写入config
    config._particleVerticalCount = Math.floor(
      img.height * (config.particleHorizontalCount / img.width)
    );
    if (config.behavior === "Keep Center") {
      offset.x =
        (canvas.width - config.particleHorizontalCount * config.scaleRate) / 2;
      offset.y =
        (canvas.height - config._particleVerticalCount * config.scaleRate) / 2;
    } else if (config.behavior === "Follow Click") {
      offset.x =
        forcePosition.x -
        (config.particleHorizontalCount * config.scaleRate) / 2;
      offset.y =
        forcePosition.y -
        (config._particleVerticalCount * config.scaleRate) / 2;
    } else if (config.behavior === "Follow Move") {
      offset.x = 0;
      offset.y = 0;
    }
    // 临时绘制图像，通过这样的方式获取一个较低分辨率的图像数据
    ctx.drawImage(
      img,
      0,
      0,
      config.particleHorizontalCount,
      config._particleVerticalCount
    );
    // 获取低分辨率图像的数据，之后为粒子赋值
    imgData = ctx.getImageData(
      0,
      0,
      config.particleHorizontalCount,
      config.particleHorizontalCount
    );

    // 开始循环遍历
    for (let i = 0; i < config.particleHorizontalCount; i++) {
      for (let j = 0; j < config._particleVerticalCount; j++) {
        pixelIndex = (i + j * config.particleHorizontalCount) * 4;
        if (
          imgData.data[pixelIndex] +
            imgData.data[pixelIndex + 1] +
            imgData.data[pixelIndex + 2] <=
            config.particleThreshold &&
          imgData.data[pixelIndex + 3] !== 0
        ) {
          // 当前读取像素数据的索引，乘以4是因为颜色数据中总共有RGBA三个通道
          // 尽可能的复用粒子
          // 这里要考虑的是两张图片直接的切换情况
          if (particleList.length < particleIndex + 1) {
            // debugger
            particleList.push(
              new Particle(
                // 当前的位置随机给一个初始值
                offset.x +
                  Math.random() *
                    config.particleHorizontalCount *
                    config.scaleRate,
                offset.y +
                  Math.random() *
                    config._particleVerticalCount *
                    config.scaleRate,
                // 目标位置，即粒子在图片中的位置
                offset.x + i * config.scaleRate,
                offset.y + j * config.scaleRate,
                // 颜色数据
                `rgb(${imgData.data[pixelIndex]},${
                  imgData.data[pixelIndex + 1]
                },${imgData.data[pixelIndex + 2]})`
              )
            );
          } else {
            // 如果粒子的数量是足够的，直接复用
            // 但是需要调整粒子的目标位置，因为切换图片的时候粒子的位置不大可能保持一致
            particleList[particleIndex].ox = offset.x + i * config.scaleRate;
            particleList[particleIndex].oy = offset.y + j * config.scaleRate;
            // 颜色也需要同步更改
            particleList[particleIndex].color = `rgb(${
              imgData.data[pixelIndex]
            },${imgData.data[pixelIndex + 1]},${imgData.data[pixelIndex + 2]})`;
          }
          // 准备下一次获取数据的索引
          particleIndex++;
        }
      }
    }
    // 移除列表中多余的粒子
    if (particleList.length > particleIndex) {
      particleList.splice(particleIndex);
    }
    // 为了切换图片的时候显得更加具有随机性，这里对粒子列表的顺序进行随机交换
    for (let i = 0; i < particleList.length; i++) {
      const randomIndex = Math.floor(Math.random() * particleList.length);
      // 随机交换
      particleA = particleList[i];
      particleB = particleList[randomIndex];
      // 交换在列表中的位置
      particleList[i] = particleB;
      particleList[randomIndex] = particleA;
    }
    updateParticleCountVisual(particleList.length);
  };
}
function updateParticleCountVisual(count) {
  gsap.to(particleCountWrapper, {
    value: count,
    duration: 1,
    ease: "power4.out",
    onUpdate: () => {
      particleCountContainer.innerHTML = `x${parseInt(
        particleCountWrapper.value
      )}`
        .split("")
        .map((item) => (item === " " ? item : `<span>${item}</span>`))
        .join("");
    },
  });
}
function preloadImg() {
  for (let i = 0; i < imgList.length; i++) {
    const img = new Image();
    img.src = imgList[i];
  }
}
function changeImg() {
  const tl = gsap.timeline();
  tl.to(charaItemHighlight, {
    x: imgIndex * 220,
    duration: 0.3,
    ease: "power4.out",
  })
    .to(
      charaItemList[imgIndex],
      {
        scale: 0.9,
        duration: 0.15,
        ease: "power1.out",
      },
      0
    )
    .to(charaItemList[imgIndex], {
      scale: 1,
      duration: 0.15,
      ease: "power1.in",
    });

  imgURL = imgList[imgIndex];
  loadImg(imgURL);
}
function setCanvasSize() {
  canvas.width = canvas.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.clientHeight * window.devicePixelRatio;
}
function syncForcePointPosition() {
  forcePoint.style.left = `${
    forcePosition.x / devicePixelRatio - forceAreaRadius
  }px`;
  forcePoint.style.top = `${
    forcePosition.y / devicePixelRatio - forceAreaRadius
  }px`;
}
function addEvents() {
  window.addEventListener("resize", setCanvasSize);
  canvas.addEventListener("mousedown", (e) => {
    isMouceDownAndNotMove = true;
    isMouceDown = true;
  });

  canvas.addEventListener("mousemove", (e) => {
    // 绑定完鼠标事件后，成功出发了粒子的运动
    if (!isMouceDown && config.forceMoveMode === "Drag") {
      return;
    }
    isMouceDownAndNotMove = false;
    forcePosition.x = e.clientX * window.devicePixelRatio;
    forcePosition.y = e.clientY * window.devicePixelRatio;
    syncForcePointPosition();
  });

  canvas.addEventListener("mouseup", () => {
    if (isMouceDownAndNotMove) {
      imgIndex = imgIndex === imgList.length - 1 ? 0 : imgIndex + 1;
      changeImg();
    }
    isMouceDownAndNotMove = false;
    isMouceDown = false;
  });

  imgAddButton.addEventListener("click", () => {
    if (imgAddAnimating) {
      return;
    }
    imgAddAnimating = true;
    if (imgAddIsOpen) {
      const tl = gsap.timeline();
      tl.to(charaItemContainer, {
        y: "100%",
        ease: "elastic.in(1, 0.9)",
        onComplete: () => {
          gsap.set(charaItemContainer, {
            display: "none",
          });
        },
      })
        .to(
          imgAddButton,
          {
            x: 0,
            y: 0,
            rotate: 0,
            duration: 0.3,
            ease: "elastic.in(1, 0.9)",
          },
          0
        )
        .then(() => {
          imgAddAnimating = false;
        });
    } else {
      const tl = gsap.timeline();
      tl.set(charaItemContainer, {
        display: "flex",
      })
        .to(imgAddButton, {
          x: "-20px",
          y: "-200px",
          rotate: 45,
          ease: "power1.in",
          duration: 0.1,
        })
        .to(
          charaItemContainer,
          {
            y: 0,
            ease: "elastic.out(1, 0.8)",
            duration: 0.8,
          },
          "-=0.1"
        )
        .from(
          ".chara-item",
          {
            opacity: 0,
            y: 100,
            stagger: 0.1,
            duration: 1,
            ease: "elastic.out(1, 0.7)",
          },
          "-=0.3"
        )
        .then(() => {
          imgAddAnimating = false;
        });
    }
    imgAddIsOpen = !imgAddIsOpen;
  });

  charaItemList.forEach(bindCharaItemEvent);

  charaItemAdd.addEventListener("click", () => {
    input.click();
  });
}

function bindCharaItemEvent(item) {
  item.addEventListener("click", () => {
    const index = charaItemList.indexOf(item);
    imgIndex = index;
    changeImg();
  });
  const closeButton = item.querySelector(".chara-item__close");
  closeButton.addEventListener("click", (e) => {
    e.stopPropagation();
    if (imgList.length === 1) {
      return;
    }
    const index = charaItemList.indexOf(item);
    const tl = gsap.timeline();
    tl.to(item, {
      opacity: 0,
      y: 100,
      x: 220,
      marginLeft: -220,
      duration: 0.3,
      ease: "power1.out",
    }).to(item, {
      display: "none",
    });
    if (imgIndex > index || imgIndex === imgList.length - 1) {
      imgIndex--;
    }
    imgList.splice(index, 1);
    charaItemList.splice(index, 1);
    changeImg();
  });
}

function createCharaItem(data) {
  const item = document.createElement("div");
  item.classList.add("chara-item");
  const img = document.createElement("div");
  img.classList.add("chara-item__img");
  img.style.backgroundImage = `url(${data})`;
  const close = document.createElement("div");
  close.classList.add("chara-item__close");
  item.appendChild(img);
  item.appendChild(close);
  bindCharaItemEvent(item);
  return item;
}

function setupInput() {
  input.type = "file";
  input.accept = "image/png,image/jpg,image/jpeg";
  input.multiple = true;
  input.addEventListener("change", () => {
    const files = input.files;
    if (files.length === 0) {
      return;
    }
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.addEventListener("load", () => {
        const item = createCharaItem(reader.result);
        imgList.push(reader.result);
        charaItemList.push(item);
        charaItemContainer.insertBefore(item, charaItemAdd);
      });
    }
  });
}

function setupStats() {
  stats = new Stats();
  stats.dom.style.cssText =
    "position:fixed;top:0;right:0;cursor:pointer;opacity:0.9;z-index:10000";
  stats.dom.style.display = config.showFrame ? "block" : "none";
  document.body.appendChild(stats.dom);
}
function setupGUI() {
  const gui = new lil.GUI();
  gui.title("Particle Config");
  const force = gui.addFolder("ForcePoint(施力点)");
  force
    .add(config, "forceRadius", 1, 10000)
    .name("forceRadius\n(施力半径)")
    .onChange(() => {
      html.style.setProperty(
        "--force-radius",
        `${config.forceRadius / devicePixelRatio}px`
      );
    });
  force.add(config, "forceRate", 0, 5000).name("forceRate\n(施力强度)");
  force
    .add(config, "forceOffsetAngle", -180, 180)
    .name("forceOffsetAngle\n(向心力偏移角)");
  force
    .add(config, "forceMoveMode", {
      "Follow Mouse(跟随鼠标)": "Follow Mouse",
      "Drag(拖拽)": "Drag",
    })
    .name("forceMoveMode\n(施力点移动模式)");

  force
    .add(config, "showForcePoint")
    .name("showForcePoint\n(显示施力点)")
    .onChange((newValue) => {
      if (newValue) {
        forcePoint.style.display = "block";
      } else {
        forcePoint.style.display = "none";
      }
    });

  const particle = gui.addFolder("Particle(粒子)");
  particle
    .add(config, "positionReturnRate", 0, 1)
    .name("positionReturnRate\n(粒子位置回归权重)");
  particle
    .add(config, "colorReturnRate", 0, 1)
    .name("colorReturnRate\n(粒子颜色回归权重)");
  particle
    .add(config, "particleRadius", 0, 20)
    .name("particleRadius\n(粒子半径)")
    .listen();
  particle
    .add(config, "particleShape", {
      "Circle(圆形)": "Circle",
      "Square(正方形)": "Square",
    })
    .name("particleShape\n(粒子形状)");
  particle
    .add(config, "particleThreshold", 0, 765)
    .name("particleThreshold\n(粒子显示颜色阈值)")
    .onChange(() => {
      changeImg();
    });
  particle
    .add(config, "particleHorizontalCount", 1, 200, 1)
    .name("particleHorizontalCount\n(水平方向粒子数量)")
    .onChange(() => {
      changeImg();
    })
    .listen();
  const graph = gui.addFolder("Graph(图形)");
  graph
    .add(config, "scaleRate", 0.1, 20)
    .name("scaleRate\n(图形缩放比例)")
    .onChange(() => {
      changeImg();
    })
    .listen();
  graph
    .add(config, "showFrame")
    .name("showFrame\n(显示帧率)")
    .onChange((newValue) => {
      stats.dom.style.display = newValue ? "block" : "none";
    });
  const other = gui.addFolder("Other(其他)");
  other
    .add(config, "behavior", {
      "Follow Click(跟随点击)": "Follow Click",
      "Keep Center(保持居中)": "Keep Center",
      "Follow Move(跟随移动)": "Follow Move",
    })
    .name("behavior\n(行为模式)")
    .onChange(() => {
      if (config.behavior === "Follow Move") {
        config.particleRadius = 2.5;
        config.particleHorizontalCount = 50;
        config.scaleRate = 5;
      } else {
        config.particleRadius = 5;
        config.particleHorizontalCount = 120;
        config.scaleRate = 10;
      }
      particleList.splice(0);
      changeImg();
    });
  other.add(config, "screenShot").name("screenShot\n(截图)");
  other.add(config, "toggleFullScreen").name("toggleFullScreen\n(切换全屏)");
}
function ani() {
  stats.begin();
  // 首先清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // 然后开始绘制
  particleList.forEach((particle) => {
    particle.updatePosition();
    particle.updateColor();
    particle.draw();
  });
  stats.end();
  // 循环调用
  requestAnimationFrame(ani);
}

setCanvasSize();
addEvents();
preloadImg();
changeImg();
setupInput();
setupStats();
setupGUI();
ani();
