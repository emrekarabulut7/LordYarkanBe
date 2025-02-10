const express = require('express');
const router = express.Router();
const { createListing, getListings, getUserListings } = require('../controllers/listingController');
const { protect } = require('../middleware/authMiddleware');

// İlan oluşturma route'u - auth gerekli
router.post('/create', protect, createListing);

// İlanları getirme route'u - auth gereksiz
router.get('/', getListings);

// Kullanıcının ilanlarını getirme route'u
router.get('/user/:userId', protect, getUserListings);

module.exports = router; 