console.log("This is running in the MAIN world, hopefully before all other scripts!");

// const ORIG_XMLHttpRequest = XMLHttpRequest;
window.ORIG_XMLHttpRequest = XMLHttpRequest;

// Proxy XMLHttpRequest, to intercept assignments to onreadystatechange:
const xhrObjectHandler = {
    // set(target, prop, value) {
    //     console.log(`xhrObjectHandler: .${prop} being set to ${value} on target ${target}!`);
    //     return target[prop] = value;
    // }
    // get(target, prop, receiver) {
    //     // By default, it looks like Reflect.get(target, prop, receiver)
    //     // which has a different value of `this`
    //     return target[prop];
    // },
    get(target, prop, receiver) {
        console.log(`xhrObjectHandler: get(prop=${prop}) called on target`, target, '!');
        const value = target[prop];
        if (value instanceof Function) {
            console.log(`xhrObjectHandler: get(prop=${prop}) called on target`, target, ': About to handle function as special case');
            return function (...args) {
                return value.apply(this === receiver ? target : this, args);
            };
        }
        console.log(`xhrObjectHandler: get(prop=${prop}) called on target`, target, ': About to return ordinary value ', value);
        return value;
    },
};

const xhrClassHandler = {
    construct(target, args) {
        console.log(`xhrClassHandler: Constructing new XHR object with args`, args, `for target ${target}!`);
        // return new target(...args);
        // return new Proxy(new target(...args), xhrObjectHandler);
        return new Proxy(new ORIG_XMLHttpRequest(...args), xhrObjectHandler);
    }
};

xhrProxy = new Proxy(XMLHttpRequest, xhrClassHandler);
window.XMLHttpRequest = xhrProxy;      // Sparks fly!

// Quick test
const exampleUrl = 'http://localhost:8080/api/v1/movie/66';
console.log(`About to construct XHR for ${exampleUrl}`);
const xhr = new XMLHttpRequest();
console.log(`Constructed XHR for ${exampleUrl}`);
xhr.open('GET', exampleUrl);
console.log(`Called open() on XHR for ${exampleUrl}`);
xhr.somedummyproperty = 123;
console.log(`Assigned to somedummyproperty of XHR for ${exampleUrl}`);
xhr.onreadystatechange = function (e) {
    console.log("readystatechange happened: ", e.target.readyState);
    if (e.target.readyState === 4) {
        console.log("Contents:", e.target.responseText);
    }
};
console.log(`Assigned to onreadystatechange of XHR for ${exampleUrl}`);
xhr.send();
console.log(`Called send() on XHR for ${exampleUrl}`);

console.log("We have proxied XMLHttpRequest!");
