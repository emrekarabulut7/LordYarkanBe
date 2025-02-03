const express = require('express');
const router = express.Router();
const { createListing, getListings } = require('../controllers/listingController');
const { protect } = require('../middleware/authMiddleware');

// İlan oluşturma route'u - auth gerekli
router.post('/create', protect, createListing);

// İlanları getirme route'u - auth gereksiz
router.get('/', getListings);

module.exports = router; 