let clickHoverNote = document.getElementById('clickHoverNote');
let fullScreenNote = document.getElementById("fullScreenNote");

fullScreenNote.addEventListener('click', () => {
    fullScreenNote.remove();
});

clickHoverNote.addEventListener('click', () => {
    clickHoverNote.remove();
});

const $navbarBurgers = Array.prototype.slice.call(document.querySelectorAll('.navbar-burger'), 0);

// Check if there are any navbar burgers
if ($navbarBurgers.length > 0) {
    // Add a click event on each of them
    $navbarBurgers.forEach(el => {
        el.addEventListener('click', () => {

            // Get the target from the "data-target" attribute
            const target = el.dataset.target;
            const $target = document.getElementById(target);

            // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
            el.classList.toggle('is-active');
            $target.classList.toggle('is-active');

            // console.log(el);

        });
    });
}

let menuBurger = document.getElementById("menuBurger");
let homePage = document.getElementById("homeBody");
let aboutBody = document.getElementById("aboutBody");

let homeNav = document.getElementById("homeNav");
let aboutMeNav = document.getElementById("aboutMeNav");

homeNav.onclick = function(){
    homePage.style.display = "block";
    aboutBody.style.display = "none";
    document.getElementsByTagName("html")[0].style.overflowY = "hidden";
    
    const target = menuBurger.dataset.target;
    const $target = document.getElementById(target);
    menuBurger.classList.toggle('is-active');
    $target.classList.toggle('is-active');
    jQuery('html,body').animate({scrollTop:0},500);
}


aboutMeNav.onclick = function(){
    homePage.style.display = "none";
    aboutBody.style.display = "block";
    document.getElementsByTagName("html")[0].style.overflowY = "auto";

    const target = menuBurger.dataset.target;
    const $target = document.getElementById(target);
    menuBurger.classList.toggle('is-active');
    $target.classList.toggle('is-active');
}