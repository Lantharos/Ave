package net.aveid.mobile.ui

import android.graphics.Color as AndroidColor
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.animateColorAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import coil.compose.AsyncImage
import net.aveid.auth.mobile.IdentityProfile
import net.aveid.auth.mobile.PendingLoginRequest

enum class MainTab { HOME, SECURITY, ID, SETTINGS }

@Composable
fun MainAppScreen(
    identities: List<IdentityProfile>,
    pendingRequests: List<PendingLoginRequest>,
    onOpenRequest: (String) -> Unit,
    onDenyRequest: (String) -> Unit,
    onOpenQrScanner: () -> Unit,
    onLogout: () -> Unit,
) {
    var selectedTab by remember { mutableStateOf(MainTab.HOME) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(AveColors.Background)
    ) {
        when (selectedTab) {
            MainTab.HOME -> HomeTab(identities)
            MainTab.SECURITY -> SecurityTab(pendingRequests, onOpenRequest, onDenyRequest, onOpenQrScanner)
            MainTab.ID -> IdTab()
            MainTab.SETTINGS -> SettingsTab(onLogout)
        }

        FloatingNav(
            selectedTab = selectedTab,
            onSelect = { selectedTab = it },
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp)
                .zIndex(2f),
        )
    }
}

@Composable
private fun FloatingNav(
    selectedTab: MainTab,
    onSelect: (MainTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    val navBgColor = Color(0xFF242424)
    Row(
        modifier = modifier
            .fillMaxWidth(0.82f)
            .height(66.dp)
            .background(navBgColor, CircleShape)
            .padding(horizontal = 8.dp),
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        NavBarIcon(selectedTab == MainTab.HOME, { onSelect(MainTab.HOME) }) { tint, _ ->
            Icon(Icons.Default.Home, null, tint = tint, modifier = Modifier.size(26.dp))
        }
        NavBarIcon(selectedTab == MainTab.SECURITY, { onSelect(MainTab.SECURITY) }) { tint, _ ->
            Icon(Icons.Default.Shield, null, tint = tint, modifier = Modifier.size(26.dp))
        }
        NavBarIcon(selectedTab == MainTab.ID, { onSelect(MainTab.ID) }) { tint, isSelected ->
            AveLogo(selected = isSelected, modifier = Modifier.size(28.dp))
        }
        NavBarIcon(selectedTab == MainTab.SETTINGS, { onSelect(MainTab.SETTINGS) }) { tint, _ ->
            Icon(Icons.Default.Settings, null, tint = tint, modifier = Modifier.size(26.dp))
        }
    }
}

@Composable
private fun NavBarIcon(selected: Boolean, onClick: () -> Unit, icon: @Composable (tint: Color, isSelected: Boolean) -> Unit) {
    val iconTint by animateColorAsState(
        targetValue = if (selected) Color.Black else AveColors.AccentGray,
        animationSpec = tween(durationMillis = 180),
        label = "navIconTint"
    )
    val activeBg by animateColorAsState(
        targetValue = if (selected) Color.White else Color.Transparent,
        animationSpec = tween(durationMillis = 180),
        label = "navIconBg"
    )
    val iconScale by animateFloatAsState(
        targetValue = if (selected) 1f else 0.9f,
        animationSpec = tween(durationMillis = 180),
        label = "navIconScale"
    )

    Box(
        modifier = Modifier
            .size(42.dp)
            .scale(iconScale)
            .clip(CircleShape)
            .background(activeBg)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        icon(iconTint, selected)
    }
}

@Composable
private fun HomeTab(identities: List<IdentityProfile>) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 52.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        identities.forEach { identity ->
            IdentityCard(identity)
        }
        Spacer(modifier = Modifier.height(220.dp))
    }
}

@Composable
private fun IdentityCard(identity: IdentityProfile) {
    val fallbackBanner = bannerFallbackColor(identity.bannerUrl) ?: AveColors.Background

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(AveColors.CardBg, RoundedCornerShape(32.dp))
            .padding(bottom = 24.dp),
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(90.dp)
                    .clip(RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp))
                    .background(fallbackBanner),
            ) {
                if (!identity.bannerUrl.isNullOrBlank() && !identity.bannerUrl.startsWith("#")) {
                    AsyncImage(
                        model = identity.bannerUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }

            Spacer(modifier = Modifier.height(56.dp))

            Column(
                modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                IdentityField("NAME", identity.displayName)
                IdentityField("HANDLE", identity.handle)
            }
        }

        Box(
            modifier = Modifier
                .padding(start = 20.dp, top = 66.dp)
                .size(86.dp)
                .background(AveColors.CardBg, RoundedCornerShape(26.dp))
                .padding(6.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (!identity.avatarUrl.isNullOrBlank()) {
                AsyncImage(
                    model = identity.avatarUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(20.dp)),
                )
            } else {
                Text(
                    text = identity.displayName.firstOrNull()?.uppercase() ?: "A",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

private fun bannerFallbackColor(rawValue: String?): Color? {
    val value = rawValue?.trim().orEmpty()
    if (!value.startsWith("#")) return null
    return runCatching { Color(AndroidColor.parseColor(value)) }.getOrNull()
}

@Composable
private fun IdentityField(label: String, value: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(AveColors.Background, RoundedCornerShape(22.dp))
            .padding(horizontal = 20.dp, vertical = 16.dp),
    ) {
        Column {
            Text(
                text = label,
                color = AveColors.MutedText,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = value, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun SecurityTab(
    pendingRequests: List<PendingLoginRequest>,
    onOpenRequest: (String) -> Unit,
    onDenyRequest: (String) -> Unit,
    onOpenQrScanner: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 52.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(AveColors.CardBg, RoundedCornerShape(26.dp))
                .clickable(onClick = onOpenQrScanner)
                .padding(horizontal = 24.dp, vertical = 24.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "QR SCANNER",
                    color = Color.White,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.5.sp,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Scan a code to login from another device.",
                    color = AveColors.MutedText,
                    fontSize = 15.sp,
                )
            }
            Spacer(modifier = Modifier.width(16.dp))
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .background(AveColors.Background, RoundedCornerShape(18.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowForwardIos,
                    contentDescription = null,
                    tint = AveColors.MutedText,
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        if (pendingRequests.isNotEmpty()) {
            Text(
                text = "PENDING LOGINS",
                color = AveColors.MutedText,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(start = 6.dp)
            )

            pendingRequests.take(6).forEach { request ->
                PendingRequestActionRow(
                    request = request,
                    onConfirm = { onOpenRequest(request.id) },
                    onDeny = { onDenyRequest(request.id) },
                )
            }
        }

        Spacer(modifier = Modifier.height(220.dp))
    }
}

@Composable
private fun PendingRequestActionRow(
    request: PendingLoginRequest,
    onConfirm: () -> Unit,
    onDeny: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(AveColors.CardBg, RoundedCornerShape(24.dp))
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = request.deviceName.uppercase(),
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold,
            )
            Text(
                text = "${request.browser} on ${request.os}",
                color = AveColors.MutedText,
                fontSize = 13.sp,
            )
            Text(
                text = request.ipAddress,
                color = AveColors.MutedText,
                fontSize = 12.sp,
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .background(AveColors.Background, CircleShape)
                    .clickable(onClick = onConfirm)
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("CONFIRM", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }

            Box(
                modifier = Modifier
                    .weight(1f)
                    .background(AveColors.Background, CircleShape)
                    .clickable(onClick = onDeny)
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("DENY", color = Color(0xFFF05757), fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun IdTab() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 52.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(AveColors.CardBg, RoundedCornerShape(32.dp))
                .padding(22.dp),
        ) {
            Column {
                Text("RANDOM THOUGHT FOR TODAY...", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(10.dp))
                Text("If every login left a footprint, what path have you created?", color = AveColors.MutedText, fontSize = 14.sp)
            }
        }

        IdSettingRow("SECURITY")
        IdSettingRow("DEVICES")
        IdSettingRow("MY DATA")
        IdSettingRow("ACTIVITY LOG")
        Spacer(modifier = Modifier.height(220.dp))
    }
}

@Composable
private fun IdSettingRow(title: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AveColors.CardBg, CircleShape)
            .padding(horizontal = 20.dp, vertical = 17.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        Icon(Icons.AutoMirrored.Filled.ArrowForwardIos, contentDescription = null, tint = Color.White)
    }
}

@Composable
private fun SettingsTab(onLogout: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 52.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(modifier = Modifier.height(120.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            AveLogo(
                selected = true,
                modifier = Modifier.size(64.dp)
            )
            Spacer(modifier = Modifier.width(18.dp))
            Column {
                Text("Ave", color = Color.White, fontSize = 45.sp, fontWeight = FontWeight.ExtraBold)
                Text("v1.0.5.33", color = AveColors.MutedText, fontSize = 16.sp)
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        SettingsRow("VIEW OUR POLICES", Color.White, null)
        Spacer(modifier = Modifier.height(10.dp))
        SettingsRow("LOG OUT", Color(0xFFF05757), onLogout)
        Spacer(modifier = Modifier.height(220.dp))
    }
}

@Composable
private fun SettingsRow(label: String, color: Color, onClick: (() -> Unit)?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AveColors.CardBg, CircleShape)
            .clickable(enabled = onClick != null) { onClick?.invoke() }
            .padding(horizontal = 20.dp, vertical = 17.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = color, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        Icon(Icons.AutoMirrored.Filled.ArrowForwardIos, contentDescription = null, tint = color)
    }
}
