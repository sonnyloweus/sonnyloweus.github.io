var cursor = {
    delay: 8,
    _x: 0,
    _y: 0,
    endX: (window.innerWidth / 2),
    endY: (window.innerHeight / 2),
    cursorVisible: true,
    cursorEnlarged: false,
    $dot: document.querySelector('.cursor-dot'),
    $outline: document.querySelector('.cursor-dot-outline'),

    init: function () {
        this.dotSize = this.$dot.offsetWidth;
        this.outlineSize = this.$outline.offsetWidth;

        this.setupEventListeners();
        this.animateDotOutline();
    },

    setupEventListeners: function () {
        var self = this;

        // Anchor hovering
        document.querySelectorAll('a').forEach(function (el) {
            el.addEventListener('mouseover', function () {
                self.cursorEnlarged = true;
                self.toggleCursorSize();
            });
            el.addEventListener('mouseout', function () {
                self.cursorEnlarged = false;
                self.toggleCursorSize();
            });
        });

        // Click events
        document.addEventListener('mousedown', function () {
            self.cursorEnlarged = true;
            self.toggleCursorSize();
        });
        document.addEventListener('mouseup', function () {
            self.cursorEnlarged = false;
            self.toggleCursorSize();
        });


        document.addEventListener('mousemove', function (e) {
            // Show the cursor
            self.cursorVisible = true;
            self.toggleCursorVisibility();

            // Position the dot
            self.endX = e.pageX;
            self.endY = e.pageY;
            self.$dot.style.top = self.endY + 'px';
            self.$dot.style.left = self.endX + 'px';
        });

        // Hide/show cursor
        document.addEventListener('mouseenter', function (e) {
            self.cursorVisible = true;
            self.toggleCursorVisibility();
            self.$dot.style.opacity = 1;
            self.$outline.style.opacity = 1;
        });

        document.addEventListener('mouseleave', function (e) {
            self.cursorVisible = true;
            self.toggleCursorVisibility();
            self.$dot.style.opacity = 0;
            self.$outline.style.opacity = 0;
        });
    },

    animateDotOutline: function () {
        var self = this;

        self._x += (self.endX - self._x) / self.delay;
        self._y += (self.endY - self._y) / self.delay;
        self.$outline.style.top = self._y + 'px';
        self.$outline.style.left = self._x + 'px';

        requestAnimationFrame(this.animateDotOutline.bind(self));
    },

    toggleCursorSize: function () {
        var self = this;

        if (self.cursorEnlarged) {
            self.$dot.style.transform = 'translate(-50%, -50%) scale(0.75)';
            self.$outline.style.transform = 'translate(-50%, -50%) scale(1.5)';
        } else {
            self.$dot.style.transform = 'translate(-50%, -50%) scale(1)';
            self.$outline.style.transform = 'translate(-50%, -50%) scale(1)';
        }
    },

    toggleCursorVisibility: function () {
        var self = this;

        if (self.cursorVisible) {
            self.$dot.style.opacity = 1;
            self.$outline.style.opacity = 1;
        } else {
            self.$dot.style.opacity = 0;
            self.$outline.style.opacity = 0;
        }
    }
}

cursor.init();

//scroll Line

let scrollLineTemplate = document.getElementById("scrollLineTemplate");
let scrollCircleTemplate = document.getElementById("scrollCircleTemplate");
let scrollWidthRatio = .073099;
//
scrollLineTemplate.setAttribute("x1", 0);
scrollLineTemplate.setAttribute("y1", 10);
//
scrollLineTemplate.setAttribute("x2", window.innerWidth*scrollWidthRatio);
scrollLineTemplate.setAttribute("y2", 10);
//
scrollCircleTemplate.setAttribute("cx", window.innerWidth*scrollWidthRatio + 8.5);
scrollCircleTemplate.setAttribute("cy", 10);


window.addEventListener("scroll", scrollDown);

function scrollDown() {
    let scrollpercent = (window.pageYOffset) / (document.documentElement.scrollHeight - document.documentElement.clientHeight);

    let draw = (window.innerHeight - 50) * scrollpercent;

    scrollLineTemplate.setAttribute("y1", draw + 10);
    scrollLineTemplate.setAttribute("y2", draw + 10);
    scrollCircleTemplate.setAttribute("cy", draw + 10);
}

function getBoundingRect(element) {

    var style = window.getComputedStyle(element); 
    var margin = {
        left: parseInt(style["margin-left"]),
        right: parseInt(style["margin-right"]),
        top: parseInt(style["margin-top"]),
        bottom: parseInt(style["margin-bottom"])
    };
    var padding = {
        left: parseInt(style["padding-left"]),
        right: parseInt(style["padding-right"]),
        top: parseInt(style["padding-top"]),
        bottom: parseInt(style["padding-bottom"])
    };
    var border = {
        left: parseInt(style["border-left"]),
        right: parseInt(style["border-right"]),
        top: parseInt(style["border-top"]),
        bottom: parseInt(style["border-bottom"])
    };
    
    
    var rect = element.getBoundingClientRect();
    rect = {
        left: rect.left - margin.left,
        right: rect.right - margin.right - padding.left - padding.right,
        top: rect.top - margin.top,
        bottom: rect.bottom - margin.bottom - padding.top - padding.bottom - border.bottom  
    };
    rect.width = rect.right - rect.left;
    rect.height = rect.bottom - rect.top;
    return rect;
    
};


$(window).load(function() {
    $('.loader').fadeOut('slow');
    $("#page").css("display", "block");

    let aboutMe = document.getElementById('aboutMe');
    let photography = document.getElementById('aboutPhotography');
    let developer = document.getElementById('aboutDeveloping');

    let body = document.body,
        html = document.documentElement;

    let screenHeight = window.innerHeight;
    let height = Math.max(body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight);


    let elementOffset = aboutMe.getBoundingClientRect().top;
    let tempHeight = (screenHeight) * (elementOffset / height);
    document.getElementById("aboutMeScroll").style.top = tempHeight + "px";

    elementOffset = photography.getBoundingClientRect().top;
    tempHeight = (screenHeight) * (elementOffset / height);
    document.getElementById("photographyScroll").style.top = tempHeight + "px";

    elementOffset = developer.getBoundingClientRect().top;
    tempHeight = (screenHeight) * (elementOffset / height);
    document.getElementById("developerScroll").style.top = tempHeight + "px";

    enableScroll();
 });