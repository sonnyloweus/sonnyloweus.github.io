// Keyboard Effect
let paper = document.getElementById("text-input");
let instructions = document.getElementById("instructions");
let caps = false;
let shifted = false;

document.addEventListener("DOMContentLoaded", function () {

    document.getElementById("caps-lock").addEventListener("click", function () {
        caps = !caps;
        this.childNodes[0].classList.toggle("on");
    });

    document.getElementById("space").addEventListener("click", function () {
        instructions.style.display = "none";
        paper.textContent += String.fromCharCode(160);
    });

    document.getElementById("delete").addEventListener("click", function () {
        instructions.style.display = "none";
        paper.textContent = paper.innerText.substring(0, paper.innerText.length - 1);
    });

    document.getElementById("clear").addEventListener("click", function () {
        instructions.style.display = "none";
        paper.textContent = "";
    });

    let textKeys = document.getElementsByClassName("letters");
    let dualKeys = document.getElementsByClassName("dual");

    document.getElementById("shift1").addEventListener("click", function () {
        shifted = !shifted;
    });

    document.getElementById("shift2").addEventListener("click", function () {
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
});

function addTextKey(capitol, key) {
    instructions.style.display = "none";
    if (!capitol)
        key = key.toLowerCase();
    paper.innerText += key;
}

function addDualKey(capitol, key) {
    instructions.style.display = "none";
    console.log(key.charAt(2));
    if (!capitol) key = key.charAt(2);
    else key = key.charAt(0);
    paper.innerText += key;
}


// Typing Effect

let i = 0;
let j = 0;
let contents = ["Photographer", "Sonny Lowe", "Researcher", "Programmer", "GPT, LLM, CNN"];
let speed = 75;
let inputSpace = document.getElementById("typed");

function typer() {
    if (i < contents[j].length) {
        inputSpace.innerHTML += contents[j].charAt(i);
        i++;
        setTimeout(typer, speed);
    }
}

function deleter() {
    if (i > 0) {
        inputSpace.innerHTML = inputSpace.innerText.substring(0, inputSpace.innerText.length - 1);
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