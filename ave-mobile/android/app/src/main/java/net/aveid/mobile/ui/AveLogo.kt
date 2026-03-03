package net.aveid.mobile.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color

@Composable
fun AveLogo(selected: Boolean, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.aspectRatio(24f / 23f)) {
        val w = size.width
        val h = size.height

        val scaleX = w / 24f
        val scaleY = h / 23f

        val topCircleColor = if (selected) Color(0xFF9FA4AD) else Color(0xFF7C828D)
        val bottomCircleColor = if (selected) Color(0xFFD4D8DE) else Color(0xFFA0A5AE)
        val innerCircleColor = if (selected) Color(0xCC090909) else Color(0xB3101010)

        drawCircle(
            color = topCircleColor,
            radius = 9.65179f * scaleX,
            center = Offset(14.1696f * scaleX, 9.65178f * scaleY)
        )

        drawCircle(
            color = bottomCircleColor,
            radius = 8.625f * scaleX,
            center = Offset(8.625f * scaleX, 14.375f * scaleY)
        )

        drawCircle(
            color = innerCircleColor,
            radius = 7.24074f * scaleX,
            center = Offset(14.0556f * scaleX, 9.79627f * scaleY)
        )
    }
}
