const authService = require('../services/authService');

async function adminLogin(req, res, next) {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const result = await authService.adminLogin(username, password);
    
    if (!result) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function studentLogin(req, res, next) {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const result = await authService.studentLogin(username, password);
    
    if (!result) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Student login successful',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const userId = req.user.userId;
    const result = await authService.getUserById(userId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { oldPassword, currentPassword, newPassword, confirmPassword } = req.body;
    const oldPass = oldPassword || currentPassword;
    const newPass = newPassword;
    const confPass = confirmPassword;

    if (!oldPass) {
      return res.status(400).json({
        success: false,
        message: 'Current password is required'
      });
    }

    if (!newPass) {
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }

    if (newPass.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    if (confPass && newPass !== confPass) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match'
      });
    }

    if (oldPass === newPass) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    try {
      await authService.changePassword(req.user.userId, oldPass, newPass);
      return res.status(200).json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (err) {
      if (err.message === 'Current password is incorrect' || err.message === 'New password must be at least 6 characters long') {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  adminLogin,
  studentLogin,
  getMe,
  logout,
  changePassword
};
