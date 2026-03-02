<template>
  <QrScanner @scanned="sendBackQr($event)" @error="onQrError($event)" />
</template>
