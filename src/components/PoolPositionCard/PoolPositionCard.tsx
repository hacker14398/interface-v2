import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Box, Typography, Button, useMediaQuery } from '@material-ui/core';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import { ChevronDown, ChevronUp } from 'react-feather';
import { Pair, JSBI, Percent, Currency } from '@uniswap/sdk';
import { useActiveWeb3React } from 'hooks';
import { unwrappedToken } from 'utils/wrappedCurrency';
import { useTokenBalance } from 'state/wallet/hooks';
import { useStakingInfo, getBulkPairData } from 'state/stake/hooks';
import { useTotalSupply } from 'data/TotalSupply';
import { usePair } from 'data/Reserves';
import {
  CurrencyLogo,
  DoubleCurrencyLogo,
  RemoveLiquidityModal,
} from 'components';

const useStyles = makeStyles(({ palette }) => ({
  poolButtonRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    '& .MuiButton-root': {
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      borderRadius: 10,
      '& a': {
        textDecoration: 'none',
      },
      '& p': {
        color: palette.text.primary,
      },
    },
    '& .MuiButton-outlined': {
      width: '49%',
      background: 'transparent',
      border: '1px solid #404557',
    },
    '& .MuiButton-contained': {
      width: '24%',
      border: '1px solid transparent',
      backgroundImage: 'linear-gradient(286deg, #004ce6, #3d71ff)',
      backgroundColor: 'transparent',
    },
  },
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    '& p': {
      color: palette.text.primary,
    },
  },
}));

interface PoolPositionCardProps {
  pair: Pair;
  handleAddLiquidity: (currency0: Currency, currency1: Currency) => void;
}

const PoolPositionCard: React.FC<PoolPositionCardProps> = ({
  pair,
  handleAddLiquidity,
}) => {
  const classes = useStyles();
  const history = useHistory();
  const [bulkPairData, setBulkPairData] = useState<any>(null);
  const { palette, breakpoints } = useTheme();
  const isMobile = useMediaQuery(breakpoints.down('xs'));

  const { account } = useActiveWeb3React();
  const [openRemoveModal, setOpenRemoveModal] = useState(false);

  const currency0 = unwrappedToken(pair.token0);
  const currency1 = unwrappedToken(pair.token1);

  const [, stakingTokenPair] = usePair(currency0, currency1);
  const stakingInfos = useStakingInfo(stakingTokenPair);
  const stakingInfo = useMemo(
    () => (stakingInfos && stakingInfos.length > 0 ? stakingInfos[0] : null),
    [stakingInfos],
  );

  const pairId = stakingInfo ? stakingInfo.pair : null;

  useEffect(() => {
    const pairLists = pairId ? [pairId] : [];
    getBulkPairData(pairLists).then((data) => setBulkPairData(data));
  }, [pairId]);

  const [showMore, setShowMore] = useState(false);

  const userPoolBalance = useTokenBalance(
    account ?? undefined,
    pair.liquidityToken,
  );
  const totalPoolTokens = useTotalSupply(pair.liquidityToken);

  const poolTokenPercentage =
    !!userPoolBalance &&
    !!totalPoolTokens &&
    JSBI.greaterThanOrEqual(totalPoolTokens.raw, userPoolBalance.raw)
      ? new Percent(userPoolBalance.raw, totalPoolTokens.raw)
      : undefined;

  const [token0Deposited, token1Deposited] =
    !!pair &&
    !!totalPoolTokens &&
    !!userPoolBalance &&
    // this condition is a short-circuit in the case where useTokenBalance updates sooner than useTotalSupply
    JSBI.greaterThanOrEqual(totalPoolTokens.raw, userPoolBalance.raw)
      ? [
          pair.getLiquidityValue(
            pair.token0,
            totalPoolTokens,
            userPoolBalance,
            false,
          ),
          pair.getLiquidityValue(
            pair.token1,
            totalPoolTokens,
            userPoolBalance,
            false,
          ),
        ]
      : [undefined, undefined];

  const apyWithFee = useMemo(() => {
    if (stakingInfo && bulkPairData) {
      const dayVolume = bulkPairData
        ? bulkPairData[stakingInfo.pair]?.oneDayVolumeUSD
        : 0;
      const oneYearFee =
        (dayVolume * 0.003 * 365) / bulkPairData[stakingInfo.pair]?.reserveUSD;
      const apy =
        oneYearFee > 0
          ? ((1 +
              ((Number(stakingInfo.perMonthReturnInRewards) +
                Number(oneYearFee) / 12) *
                12) /
                12) **
              12 -
              1) *
            100
          : 0; // compounding monthly APY
      if (apy > 100000000) {
        return '>100000000';
      } else {
        return Number(apy.toFixed(2)).toLocaleString();
      }
    }
  }, [stakingInfo, bulkPairData]);

  return (
    <Box
      width={1}
      border={`1px solid ${palette.secondary.dark}`}
      borderRadius={10}
      bgcolor={showMore ? palette.secondary.dark : 'transparent'}
      style={{ overflow: 'hidden' }}
    >
      <Box
        paddingX={isMobile ? 1.5 : 3}
        paddingY={isMobile ? 2 : 3}
        display='flex'
        alignItems='center'
        justifyContent='space-between'
      >
        <Box display='flex' alignItems='center'>
          <DoubleCurrencyLogo
            currency0={currency0}
            currency1={currency1}
            margin={true}
            size={28}
          />
          <Typography
            variant='h6'
            style={{ color: palette.text.primary, marginLeft: 16 }}
          >
            {!currency0 || !currency1
              ? 'Loading'
              : `${currency0.symbol}/${currency1.symbol}`}
          </Typography>
        </Box>

        <Box
          display='flex'
          alignItems='center'
          color={palette.primary.main}
          style={{ cursor: 'pointer' }}
          onClick={() => setShowMore(!showMore)}
        >
          <Typography variant='body1' style={{ marginRight: 8 }}>
            Manage
          </Typography>
          {showMore ? <ChevronUp size='20' /> : <ChevronDown size='20' />}
        </Box>
      </Box>

      {showMore && (
        <Box px={isMobile ? 1.5 : 3} mb={3}>
          <Box className={classes.cardRow}>
            <Typography variant='body2'>Your pool tokens:</Typography>
            <Typography variant='body2'>
              {userPoolBalance ? userPoolBalance.toSignificant(4) : '-'}
            </Typography>
          </Box>
          <Box className={classes.cardRow}>
            <Typography variant='body2'>Pooled {currency0.symbol}:</Typography>
            {token0Deposited ? (
              <Box display='flex' alignItems='center'>
                <Typography variant='body2' style={{ marginRight: 10 }}>
                  {token0Deposited?.toSignificant(6)}
                </Typography>
                <CurrencyLogo size='20px' currency={currency0} />
              </Box>
            ) : (
              '-'
            )}
          </Box>

          <Box className={classes.cardRow}>
            <Typography variant='body2'>Pooled {currency1.symbol}:</Typography>
            {token1Deposited ? (
              <Box display='flex' alignItems='center'>
                <Typography variant='body2' style={{ marginRight: 10 }}>
                  {token1Deposited?.toSignificant(6)}
                </Typography>
                <CurrencyLogo size='20px' currency={currency1} />
              </Box>
            ) : (
              '-'
            )}
          </Box>

          <Box className={classes.cardRow}>
            <Typography variant='body2'>Your pool share:</Typography>
            <Typography variant='body2'>
              {poolTokenPercentage
                ? poolTokenPercentage.toSignificant() + '%'
                : '-'}
            </Typography>
          </Box>

          <Box className={classes.poolButtonRow}>
            <Button
              variant='outlined'
              onClick={() => history.push(`/analytics/pair/${pairId}`)}
            >
              <Typography variant='body2'>View Analytics</Typography>
            </Button>
            <Button
              variant='contained'
              onClick={() => {
                handleAddLiquidity(currency0, currency1);
              }}
            >
              <Typography variant='body2'>Add</Typography>
            </Button>
            <Button
              variant='contained'
              onClick={() => {
                setOpenRemoveModal(true);
              }}
            >
              <Typography variant='body2'>Remove</Typography>
            </Button>
          </Box>
        </Box>
      )}
      {stakingInfo && apyWithFee && (
        <Box bgcolor='#404557' paddingY={0.75} paddingX={isMobile ? 2 : 3}>
          <Typography variant='body2'>
            Earn{' '}
            <span style={{ color: palette.success.main }}>
              {apyWithFee}% APY
            </span>{' '}
            by staking your LP tokens in {currency0.symbol?.toUpperCase()} /{' '}
            {currency1.symbol?.toUpperCase()} Farm
          </Typography>
        </Box>
      )}
      {openRemoveModal && (
        <RemoveLiquidityModal
          currency0={currency0}
          currency1={currency1}
          open={openRemoveModal}
          onClose={() => setOpenRemoveModal(false)}
        />
      )}
    </Box>
  );
};

export default PoolPositionCard;
