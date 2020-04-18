let root = document.documentElement;
let i = 0;

let bgImg1 = new Image();
bgImg1.onload = function(){
    root.style.setProperty('--slide-1', 'url(' + bgImg1.src + ')');
    i++;
    checkImages(i);
};
bgImg1.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/background_black.png";

let bgImg2 = new Image();
bgImg2.onload = function(){
    root.style.setProperty('--slide-2', 'url(' + bgImg2.src + ')');
    i++;
    checkImages(i);
};
bgImg2.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_8575.JPG";

let bgImg3 = new Image();
bgImg3.onload = function(){
    root.style.setProperty('--slide-3', 'url(' + bgImg3.src + ')');
    i++;
    checkImages(i);
};
bgImg3.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_7710.JPG";

let bgImg4 = new Image();
bgImg4.onload = function(){
    root.style.setProperty('--slide-4', 'url(' + bgImg4.src + ')');
    i++;
    checkImages(i);
};
bgImg4.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_7728.JPG";

let bgImg5 = new Image();
bgImg5.onload = function(){
    root.style.setProperty('--slide-5', 'url(' + bgImg5.src + ')');
    i++;
    checkImages(i);
};
bgImg5.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_7743.JPG";

let bgImg6 = new Image();
bgImg6.onload = function(){
    root.style.setProperty('--slide-6', 'url(' + bgImg6.src + ')');
    i++;
    checkImages(i);
};
bgImg6.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_7755.JPG";

let bgImg7 = new Image();
bgImg7.onload = function(){
    root.style.setProperty('--slide-7', 'url(' + bgImg7.src + ')');
    i++;
    checkImages(i);
};
bgImg7.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/bird.jpg";

let bgImg8 = new Image();
bgImg8.onload = function(){
    root.style.setProperty('--slide-8', 'url(' + bgImg8.src + ')');
    i++;
    checkImages(i);
};
bgImg8.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_7814.JPG";

let bgImg9 = new Image();
bgImg9.onload = function(){
    root.style.setProperty('--slide-9', 'url(' + bgImg9.src + ')');
    i++;
    checkImages(i);
};
bgImg9.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_7982.JPG";

let bgImg10 = new Image();
bgImg10.onload = function(){
    root.style.setProperty('--slide-10', 'url(' + bgImg10.src + ')');
    i++;
    checkImages(i);
};
bgImg10.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_8014.JPG";

let bgImg11 = new Image();
bgImg11.onload = function(){
    root.style.setProperty('--slide-11', 'url(' + bgImg11.src + ')');
    i++;
    checkImages(i);
};
bgImg11.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_8100.JPG";

let bgImg12 = new Image();
bgImg12.onload = function(){
    root.style.setProperty('--slide-12', 'url(' + bgImg12.src + ')');
    i++;
    checkImages(i);
};
bgImg12.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_8163.JPG";

let bgImg13 = new Image();
bgImg13.onload = function(){
    root.style.setProperty('--slide-13', 'url(' + bgImg13.src + ')');
    i++;
    checkImages(i);
};
bgImg13.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_8182.JPG";

let bgImg14 = new Image();
bgImg14.onload = function(){
    root.style.setProperty('--slide-14', 'url(' + bgImg14.src + ')');
    i++;
    checkImages(i);
};
bgImg14.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_8237.JPG";

let bgImg15 = new Image();
bgImg15.onload = function(){
    root.style.setProperty('--slide-15', 'url(' + bgImg15.src + ')');
    i++;
    checkImages(i);
};
bgImg15.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_8312.JPG";

let bgImg16 = new Image();
bgImg16.onload = function(){
    root.style.setProperty('--slide-16', 'url(' + bgImg16.src + ')');
    i++;
    checkImages(i);
};
bgImg16.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_8391.JPG";

let bgImg17 = new Image();
bgImg17.onload = function(){
    root.style.setProperty('--slide-17', 'url(' + bgImg17.src + ')');
    i++;
    checkImages(i);
};
bgImg17.src = "https://storage.cloud.google.com/www.sonnylowe.us/images/IMG_7695.JPG";

function checkImages(i){
    if(i == 17){
        document.getElementsByTagName("head")[0].innerHTML += '<link href="https://storage.cloud.google.com/www.sonnylowe.us/index.css" rel="stylesheet" type="text/css">';
    }
}