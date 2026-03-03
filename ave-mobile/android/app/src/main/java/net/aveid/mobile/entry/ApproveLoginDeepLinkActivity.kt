package net.aveid.mobile.entry

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import net.aveid.auth.ui.LoginRequestsActivity

class ApproveLoginDeepLinkActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val qrToken = intent?.data?.getQueryParameter("qrToken")
        val launch = Intent(this, LoginRequestsActivity::class.java)
        if (!qrToken.isNullOrBlank()) {
            launch.putExtra(LoginRequestsActivity.EXTRA_QR_TOKEN, qrToken)
        }
        startActivity(launch)
        finish()
    }
}
