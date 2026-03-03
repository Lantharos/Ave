package net.aveid.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import net.aveid.auth.mobile.PendingLoginRequest

object AveColors {
    val Background = Color(0xFF090909)
    val CardBg = Color(0xFF171717)
    val ActionCardHover = Color(0xFF202020)
    val PrimaryBtnText = Color(0xFF090909)
    val CurrentText = Color(0xFFFFFFFF)
    val MutedText = Color(0xFF878787)
    val AccentGray = Color(0xFFB9BBBE)
}

@Composable
fun MainTitle(text: String) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.headlineMedium.copy(
            fontWeight = FontWeight.Black,
            fontSize = 32.sp,
            letterSpacing = 1.sp,
            textAlign = TextAlign.Center
        ),
        color = AveColors.CurrentText.copy(alpha = 0.8f),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
fun SubTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyLarge.copy(
            fontWeight = FontWeight.Normal,
            fontSize = 16.sp,
            textAlign = TextAlign.Center
        ),
        color = AveColors.MutedText,
        modifier = modifier.fillMaxWidth()
    )
}

@Composable
fun InputWrapperBox(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(AveColors.CardBg.copy(alpha = 0.8f), RoundedCornerShape(32.dp))
            .padding(24.dp)
    ) {
        content()
    }
}

@Composable
fun AveTextField(value: String, placeholder: String, onChange: (String) -> Unit) {
    TextField(
        value = value,
        onValueChange = onChange,
        placeholder = { Text(placeholder, color = AveColors.MutedText) },
        singleLine = true,
        colors = TextFieldDefaults.colors(
            focusedContainerColor = AveColors.Background.copy(alpha = 0.5f),
            unfocusedContainerColor = AveColors.Background.copy(alpha = 0.5f),
            focusedTextColor = AveColors.CurrentText,
            unfocusedTextColor = AveColors.CurrentText,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            cursorColor = AveColors.AccentGray,
        ),
        shape = CircleShape,
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
fun AvePrimaryButton(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier.fillMaxWidth(),
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        colors = ButtonDefaults.buttonColors(
            containerColor = AveColors.AccentGray,
            contentColor = AveColors.PrimaryBtnText,
            disabledContainerColor = AveColors.AccentGray.copy(alpha = 0.5f),
            disabledContentColor = AveColors.PrimaryBtnText.copy(alpha = 0.5f)
        ),
        shape = CircleShape,
        modifier = modifier.height(60.dp),
    ) {
        Text(
            text = label.uppercase(),
            fontWeight = FontWeight.Black,
            fontSize = 18.sp,
            letterSpacing = 1.sp
        )
    }
}

@Composable
fun AveSecondaryButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(
            containerColor = AveColors.CardBg,
            contentColor = AveColors.CurrentText
        ),
        shape = CircleShape,
        modifier = modifier.height(56.dp),
    ) {
        Text(
            text = label.uppercase(),
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp
        )
    }
}

@Composable
fun AuthMethodCard(title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AveColors.CardBg, RoundedCornerShape(20.dp))
            .clickable { onClick() },
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(24.dp)
        ) {
            Text(
                text = title.uppercase(),
                color = AveColors.CurrentText,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Black)
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = subtitle,
                color = AveColors.MutedText,
                style = MaterialTheme.typography.bodyMedium
            )
        }
        
        Box(
            modifier = Modifier
                .size(64.dp)
                .background(AveColors.CardBg, RoundedCornerShape(topEnd = 20.dp, bottomEnd = 20.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                contentDescription = null,
                tint = AveColors.AccentGray,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

@Composable
fun DashboardRequestRow(request: PendingLoginRequest, onOpenRequest: (String) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AveColors.CardBg, RoundedCornerShape(20.dp))
            .clickable { onOpenRequest(request.id) }
            .padding(20.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = request.deviceName.uppercase(),
                color = AveColors.CurrentText,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Black)
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "${request.browser} on ${request.os}",
                color = AveColors.MutedText,
                style = MaterialTheme.typography.bodyMedium
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("REVIEW", color = AveColors.AccentGray, fontWeight = FontWeight.Black, fontSize = 14.sp)
            Spacer(Modifier.width(6.dp))
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                contentDescription = null,
                tint = AveColors.AccentGray,
                modifier = Modifier.size(14.dp),
            )
        }
    }
}
