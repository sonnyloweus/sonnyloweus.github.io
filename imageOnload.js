let keys = {
    37: 1,
    38: 1,
    39: 1,
    40: 1
};

function preventDefault(e) {
    e.preventDefault();
}

function preventDefaultForScrollKeys(e) {
    if (keys[e.keyCode]) {
        preventDefault(e);
        return false;
    }
}

let supportsPassive = false;
try {
    window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
        get: function () {
            supportsPassive = true;
        }
    }));
} catch (e) {}

let wheelOpt = supportsPassive ? {
    passive: false
} : false;
let wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';


// call this to Enable
function enableScroll() {
    window.removeEventListener('DOMMouseScroll', preventDefault, false);
    window.removeEventListener(wheelEvent, preventDefault, wheelOpt);
    window.removeEventListener('touchmove', preventDefault, wheelOpt);
    window.removeEventListener('keydown', preventDefaultForScrollKeys, false);
}
// call this to Disable
function disableScroll() {
    window.addEventListener('DOMMouseScroll', preventDefault, false);
    window.addEventListener(wheelEvent, preventDefault, wheelOpt);
    window.addEventListener('touchmove', preventDefault, wheelOpt);
    window.addEventListener('keydown', preventDefaultForScrollKeys, false);
}

$(window).scrollTop(0);
disableScroll();




let imageGallery = document.getElementById("myPhotos");

let files = ["bird", "IMG_7695", "IMG_7706", "IMG_7710", "IMG_7728", "IMG_7743", "IMG_7755", "IMG_7795", "IMG_7814", "IMG_7982", "IMG_8014", "IMG_8100", "IMG_8163", "IMG_8182", "IMG_8237", "IMG_8312", "IMG_8391", "IMG_8575", "IMG_8694"];
let numOfImages = files.length;
let directory = "https://storage.cloud.google.com/www.sonnylowe.us/images/";

for (let i = 0; i < numOfImages; i++) {
    let fileName = files[i];
    if (fileName == "bird") {
        fileName += ".jpg";
    } else {
        fileName += ".JPG";
    }
    imageGallery.innerHTML = imageGallery.innerHTML + `

    <div class="gallery">
        <img data-enlargable width="100" style="cursor: zoom-in" src=" ` + directory + fileName + ` " alt="Mountains" width="600" height="400">
        <div class="desc"> ID# ` + (i + 1) + ` </div>
    </div>
    
    `;
}





$('img[data-enlargable]').addClass('img-enlargable').click(function () {
    var src = $(this).attr('src');
    var modal;

    function removeModal() {
        modal.remove();
        $('body').off('keyup.modal-close');
    }
    modal = $('<div>').css({
        background: 'RGBA(0,0,0,.5) url(' + src + ') no-repeat center',
        backgroundSize: 'contain',
        width: '100%',
        height: '100%',
        position: 'fixed',
        zIndex: '10000',
        top: '0',
        left: '0',
        cursor: 'zoom-out'
    }).click(function () {
        removeModal();
    }).appendTo('body');
    //handling ESC
    $('body').on('keyup.modal-close', function (e) {
        if (e.key === 'Escape') {
            removeModal();
        }
    });
});

$("img").mousedown(function (e) {
    e.preventDefault()
});

$("img").on("contextmenu", function (e) {
    return false;
});

$(document).ready(function () {
    let $elements = $('.animateBlock.notAnimated'); 

    $(window).scroll(function (e) {
        // $('.fadeIn').each(function (i) {
        //     let top_of_object = $(this).position().top + 200;
        //     let bottom_of_window = $(window).scrollTop() + $(window).height();
        //     if (bottom_of_window > top_of_object) {
        //         $(this).animate({
        //             'opacity': '1'
        //         }, 500);
        //     }
        // });

        $elements.each(function(i, elem) { //loop through each element
            if ($(this).hasClass('animated')){ // check if already animated
              return;
            }
            animateMe($(this));
        });
    });
});

function animateMe(elem) {
    console.log("animate called");
    let winTop = $(window).scrollTop(); // calculate distance from top of window
    let winBottom = winTop + $(window).height();

    let elemTop = $(elem).position().top;
    let elemBottom = elemTop + $(elem).height();

    if((winBottom > elemTop + 300)){
        console.log("adding animate class");
        $(elem).removeClass('notAnimated').addClass('animated');
    }

    // if ((elemBottom <= winBottom) && (elemTop >= winTop)) {
    //     // exchange classes if element visible
    //     $(elem).removeClass('notAnimated').addClass('animated');
    // }
}
