// Information banner slideshow functionality
let slideIndex = 0;
const slides = document.querySelectorAll('.info-slide');

function showInfoSlides() {
    // Hide all slides
    slides.forEach(slide => {
        slide.classList.remove('active-slide');
    });
    
    // Show current slide
    if (slides.length > 0) {
        slideIndex++;
        if (slideIndex > slides.length) {
            slideIndex = 1;
        }
        slides[slideIndex - 1].classList.add('active-slide');
    }
    
    // Change slide every 5 seconds
    setTimeout(showInfoSlides, 5000);
}

// Initialize slideshow when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    showInfoSlides();
});
