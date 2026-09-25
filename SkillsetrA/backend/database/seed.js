import bcrypt from 'bcryptjs'
import pool from '../src/config/db.js'

async function seedDatabase() {
  console.log('🌱 Starting SkillsetrA Database Seed Process...')

  try {
    // 1. Ensure Exactly ONE Master Admin Account
    const adminCheck = await pool.query(`SELECT id FROM users WHERE LOWER(role) = 'admin' LIMIT 1`)
    if (adminCheck.rows.length === 0) {
      const adminUsername = process.env.ADMIN_USERNAME || 'admin'
      const adminPassword = process.env.ADMIN_PASSWORD || 'CMS@Admin'
      const adminPasswordHash = bcrypt.hashSync(adminPassword, 12)

      await pool.query(
        `INSERT INTO users (username, password_hash, role, is_active)
         VALUES ($1, $2, 'admin', true)`,
        [adminUsername, adminPasswordHash]
      )
      console.log('✅ Created Master Admin account: admin')
    } else {
      console.log('ℹ️ Master Admin account already exists.')
    }

    // 2. Ensure Initial Sample Questions (5 Aptitude, 5 Verbal)
    const questionCheck = await pool.query(`SELECT COUNT(*) FROM questions`)
    if (parseInt(questionCheck.rows[0].count, 10) === 0) {
      const sampleQuestions = [
       
      ]

      for (const q of sampleQuestions) {
        await pool.query(
          `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, category, difficulty)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.category, q.difficulty]
        )
      }
      console.log(`✅ Seeded ${sampleQuestions.length} sample questions into Question Bank.`)
    }

    console.log('🎉 Database seeding finished cleanly!')
  } catch (err) {
    console.error('❌ Error during database seeding:', err)
  } finally {
    await pool.end()
  }
}

seedDatabase()
