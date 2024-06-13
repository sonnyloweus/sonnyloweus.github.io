// Keyboard Effect
let paper = document.getElementById("text-input");
let refresh = document.getElementById("refresh");
let instructions = document.getElementById("instructions");
let caps = false;
let shifted = false;
let typing = false;

document.addEventListener("DOMContentLoaded", function () {

    document.getElementById("CAPSLOCK").addEventListener("click", function () {
        caps = !caps;
        this.childNodes[0].classList.toggle("on");
    });

    refresh.addEventListener("click", function () {
        window.location.reload();
    });

    document.getElementById("SPACE").addEventListener("click", function () {
        typed();
        paper.value += String.fromCharCode(160);
    });

    document.getElementById("TAB").addEventListener("click", function () {
        typed();
        paper.value += String.fromCharCode(160) + String.fromCharCode(160) + String.fromCharCode(160);
    });

    document.getElementById("BACKSPACE").addEventListener("click", function () {
        typed();
        paper.value = paper.value.substring(0, paper.value.length - 1);
    });

    document.getElementById("CLEAR").addEventListener("click", function () {
        typed();
        paper.textContent = "";
    });

    let textKeys = document.getElementsByClassName("letters");
    let dualKeys = document.getElementsByClassName("dual");

    document.getElementById("SHIFT").addEventListener("click", function () {
        shifted = !shifted;
    });

    document.getElementById("SHIFT1").addEventListener("click", function () {
        shifted = !shifted;
    });

    for (let i = 0; i < textKeys.length; i++) {
        textKeys[i].addEventListener("click", function () {
            if (shifted) {
                shifted = false;
                addTextKey(!caps, this.innerText);
            } else addTextKey(caps, this.innerText);
        });
    }

    for (let i = 0; i < dualKeys.length; i++) {
        dualKeys[i].addEventListener("click", function () {
            if (shifted) {
                shifted = false;
                addDualKey(!caps, this.innerText);
            } else addDualKey(caps, this.innerText);
        });
    }

    document.onkeydown = function(e) {
        typed();
        console.log(e.key);
        simulateType(e.key);
    }
});

function adjustWidth() {
    let value = paper.value;
    let width = (value.length) * 13; // 8px per character
    paper.style.width = width + "px";
 }

function addTextKey(capitol, key) {
    typed();
    if (!capitol)
        key = key.toLowerCase();
    paper.value += key;
    simulateType(key);
}

function addDualKey(capitol, key) {
    typed();
    console.log(key.charAt(2));
    if (!capitol) key = key.charAt(2);
    else key = key.charAt(0);
    paper.value += key;
    simulateType(key);
}

function typed(){
    if (!typing) {
        typing = true;
        paper.innerText = "";
    }
    instructions.style.display = "none";
    refresh.style.display = "block";
    paper.focus();
    adjustWidth();
}

function simulateType(key) {
    let simKey = document.getElementById(key.toUpperCase());
    if(simKey != null) {
        simKey.style.backgroundColor = "#aaa";
        setTimeout(function(){
            simKey.style.backgroundColor = "#eee";
        }, 150);
    }
}


// Typing Effect

let i = 0;
let j = 0;
let contents = ["Photographer", "Sonny Lowe", "Researcher", "Programmer", "GPT, LLM, CNN"];
let speed = 75;
let inputSpace = document.getElementById("typed");

function typer() {
    if (i < contents[j].length && !typing) {
        paper.value += contents[j].charAt(i);
        adjustWidth();
        simulateType(contents[j].charAt(i));
        i++;
        setTimeout(typer, speed);
    }
}

function deleter() {
    if (i > 0 && !typing) {
        paper.value = paper.value.substring(0, paper.value.length - 1);
        adjustWidth();
        simulateType("BACKSPACE");
        i--;
        setTimeout(deleter, speed);
    }
}

function pageStart() {
    if(j < contents.length-1) j++;
    else j = 0;

    typer();
    setTimeout(function(){
        deleter();
        setTimeout(pageStart, 3000)
    }, 4000);
}

pageStart();