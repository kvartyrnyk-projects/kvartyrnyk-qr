<template>
  <QrScanner @scanned="validateQr($event)" @error="onQrError($event)" />
</template>
